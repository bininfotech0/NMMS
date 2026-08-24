import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateWithdrawalRequestInput,
  WalletSummaryResponse,
  WithdrawalChargeType,
  WithdrawalRateResponse,
  WithdrawalRequestResponse,
  WithdrawalStatus,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { KycService } from "../kyc/kyc.service";
import { CryptoService } from "../common/crypto.service";
import { toWithdrawalResponse } from "./withdrawal.mapper";

// Statuses whose points may be rejected back to the member (a payout has not
// been initiated yet). Once PAYOUT_PROCESSING the funds are in-flight and the
// request can only resolve to PAID or PAYOUT_FAILED.
const OPEN_STATUSES = ["PENDING", "APPROVED"] as const;
// Statuses that lock points against new requests. PAYOUT_PROCESSING is
// included so a member can't create a second request on top of an in-flight
// payout and double-spend the same points if both succeed.
const LOCKED_STATUSES = ["PENDING", "APPROVED", "PAYOUT_PROCESSING"] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type WithdrawalSettings = {
  pointsToMoneyRatioPoints: number;
  pointsToMoneyRatioAmount: Prisma.Decimal;
  withdrawalMinAmount: Prisma.Decimal;
  withdrawalMaxAmount: Prisma.Decimal | null;
  withdrawalFrequencyDays: number | null;
  withdrawalChargeType: WithdrawalChargeType;
  withdrawalChargeValue: Prisma.Decimal;
  kycRequireAadhaar: boolean;
  kycRequirePan: boolean;
  kycRequireBankOrUpi: boolean;
};

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kyc: KycService,
    private readonly crypto: CryptoService,
  ) {}

  private computeGrossAmount(points: number, settings: WithdrawalSettings): Prisma.Decimal {
    if (!settings.pointsToMoneyRatioPoints || settings.pointsToMoneyRatioPoints <= 0) {
      throw new ConflictException("Withdrawal conversion ratio is not configured correctly");
    }
    return settings.pointsToMoneyRatioAmount.mul(points).div(settings.pointsToMoneyRatioPoints);
  }

  private computeCharge(
    grossAmount: Prisma.Decimal,
    settings: WithdrawalSettings,
  ): { chargeType: WithdrawalChargeType; chargeAmount: Prisma.Decimal; netAmount: Prisma.Decimal } {
    let chargeAmount = new Prisma.Decimal(0);
    if (settings.withdrawalChargeType === "FLAT") {
      chargeAmount = Prisma.Decimal.min(settings.withdrawalChargeValue, grossAmount);
    } else if (settings.withdrawalChargeType === "PERCENTAGE") {
      // Clamped the same as FLAT — org settings only validate
      // withdrawalChargeValue as non-negative, not <= 100, so a misconfigured
      // >100% charge must not be able to drive netAmount negative.
      chargeAmount = Prisma.Decimal.min(grossAmount.mul(settings.withdrawalChargeValue).div(100), grossAmount);
    }
    return { chargeType: settings.withdrawalChargeType, chargeAmount, netAmount: grossAmount.sub(chargeAmount) };
  }

  // Live sum of points locked in open (not yet PAID/REJECTED) requests —
  // small N per member, same live-aggregate idiom as ReferralsService's
  // applyReferralCap.
  private async getLockedPoints(
    tx: Prisma.TransactionClient,
    memberId: string,
  ): Promise<{ pending: number; approved: number; processing: number }> {
    const rows = await tx.withdrawalRequest.groupBy({
      by: ["status"],
      where: { memberId, status: { in: [...LOCKED_STATUSES] } },
      _sum: { pointsRequested: true },
    });
    const pending = rows.find((r) => r.status === "PENDING")?._sum.pointsRequested ?? 0;
    const approved = rows.find((r) => r.status === "APPROVED")?._sum.pointsRequested ?? 0;
    const processing = rows.find((r) => r.status === "PAYOUT_PROCESSING")?._sum.pointsRequested ?? 0;
    return { pending, approved, processing };
  }

  async getWalletSummary(memberId: string): Promise<WalletSummaryResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const settings = await this.getSettings(member.organizationId);
    const { pending, approved, processing } = await this.getLockedPoints(this.prisma, memberId);
    const { _sum } = await this.prisma.referralPointsLedger.aggregate({
      where: { memberId, status: "PENDING" },
      _sum: { points: true },
    });
    const pendingReviewPoints = _sum.points ?? 0;

    const earnedPoints = member.referralPointsBalance;
    const convertedPoints = member.pointsConverted;
    const availableBalancePoints = earnedPoints - convertedPoints - pending - approved - processing;
    const availableBalanceAmount = this.computeGrossAmount(Math.max(availableBalancePoints, 0), settings).toNumber();

    return {
      earnedPoints,
      pendingPoints: pending,
      approvedPoints: approved,
      convertedPoints,
      availableBalancePoints,
      availableBalanceAmount,
      withdrawnAmount: member.totalWithdrawnAmount.toNumber(),
      pendingReviewPoints,
    };
  }

  // Narrow, member-safe view of the conversion-rate settings — GET /org
  // (which has the full settings object) is staff-only, so the member
  // portal's own withdrawal-preview UI needs this instead.
  async getRate(memberId: string): Promise<WithdrawalRateResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const settings = await this.getSettings(member.organizationId);
    return {
      pointsToMoneyRatioPoints: settings.pointsToMoneyRatioPoints,
      pointsToMoneyRatioAmount: settings.pointsToMoneyRatioAmount.toNumber(),
      withdrawalChargeType: settings.withdrawalChargeType,
      withdrawalChargeValue: settings.withdrawalChargeValue.toNumber(),
    };
  }

  async listMine(memberId: string): Promise<WithdrawalRequestResponse[]> {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toWithdrawalResponse);
  }

  async createRequest(memberId: string, dto: CreateWithdrawalRequestInput): Promise<WithdrawalRequestResponse> {
    const created = await this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUniqueOrThrow({ where: { id: memberId } });
      const settings = await this.getSettings(member.organizationId, tx);

      if (member.kycStatus !== "VERIFIED") {
        throw new ConflictException("KYC verification is required before withdrawing");
      }
      if (!this.kyc.isKycComplete(member, settings)) {
        throw new ConflictException(
          "KYC requirements have changed since you were verified — please update and resubmit your KYC details",
        );
      }

      const grossAmount = this.computeGrossAmount(dto.pointsRequested, settings);
      if (grossAmount.lessThan(settings.withdrawalMinAmount)) {
        throw new ConflictException(`Minimum withdrawal amount is ₹${settings.withdrawalMinAmount.toString()}`);
      }
      if (settings.withdrawalMaxAmount && grossAmount.greaterThan(settings.withdrawalMaxAmount)) {
        throw new ConflictException(`Maximum withdrawal amount is ₹${settings.withdrawalMaxAmount.toString()}`);
      }

      if (settings.withdrawalFrequencyDays != null) {
        const lastRequest = await tx.withdrawalRequest.findFirst({
          where: { memberId, status: { not: "REJECTED" } },
          orderBy: { createdAt: "desc" },
        });
        if (lastRequest) {
          const daysSince = (Date.now() - lastRequest.createdAt.getTime()) / MS_PER_DAY;
          if (daysSince < settings.withdrawalFrequencyDays) {
            throw new ConflictException(
              `You can request another withdrawal ${Math.ceil(settings.withdrawalFrequencyDays - daysSince)} day(s) from now`,
            );
          }
        }
      }

      const { pending, approved, processing } = await this.getLockedPoints(tx, memberId);
      const availableBalance = member.referralPointsBalance - member.pointsConverted - pending - approved - processing;
      if (dto.pointsRequested > availableBalance) {
        throw new ConflictException("Insufficient available balance");
      }

      const { chargeType, chargeAmount, netAmount } = this.computeCharge(grossAmount, settings);

      return tx.withdrawalRequest.create({
        data: {
          organizationId: member.organizationId,
          memberId,
          pointsRequested: dto.pointsRequested,
          grossAmount,
          chargeType,
          chargeAmount,
          netAmount,
          payoutMethod: member.payoutMethod!,
          payoutBankAccountName: member.bankAccountName,
          payoutBankAccountNumberEncrypted: member.bankAccountNumberEncrypted,
          payoutBankAccountNumberLast4: member.bankAccountNumberLast4,
          payoutBankIfscCode: member.bankIfscCode,
          payoutBankName: member.bankName,
          payoutUpiId: member.upiId,
        },
      });
    });
    return toWithdrawalResponse(created);
  }

  // --- Admin -----------------------------------------------------------

  async adminList(organizationId: string, status?: WithdrawalStatus): Promise<WithdrawalRequestResponse[]> {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: { member: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toWithdrawalResponse);
  }

  async adminGet(id: string, organizationId: string): Promise<WithdrawalRequestResponse> {
    const row = await this.findScoped(id, organizationId);
    return toWithdrawalResponse(row);
  }

  async approve(id: string, organizationId: string, reviewerId: string): Promise<WithdrawalRequestResponse> {
    const request = await this.findScoped(id, organizationId);
    await this.assertMemberPayoutEligible(request.memberId);
    const cas = await this.prisma.withdrawalRequest.updateMany({
      where: { id, organizationId, status: "PENDING" },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: null },
    });
    if (cas.count === 0) {
      throw new ConflictException("This request is no longer pending — please refresh and try again");
    }
    return this.adminGet(id, organizationId);
  }

  async reject(
    id: string,
    organizationId: string,
    reviewerId: string,
    note: string,
  ): Promise<WithdrawalRequestResponse> {
    await this.findScoped(id, organizationId);
    const cas = await this.prisma.withdrawalRequest.updateMany({
      where: { id, organizationId, status: { in: [...OPEN_STATUSES] } },
      data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note },
    });
    if (cas.count === 0) {
      throw new ConflictException("Only a pending or approved request can be rejected");
    }
    return this.adminGet(id, organizationId);
  }

  async markPaid(
    id: string,
    organizationId: string,
    actingUserId: string,
    paymentReference?: string | null,
  ): Promise<WithdrawalRequestResponse> {
    const request = await this.findScoped(id, organizationId);
    await this.assertMemberPayoutEligible(request.memberId);
    const updated = await this.prisma.$transaction(async (tx) => {
      // APPROVED is the normal path; PAYOUT_FAILED lets an admin fall back
      // to a manual payout when the automated RazorpayX transfer failed,
      // without a reject-and-recreate round trip.
      const cas = await tx.withdrawalRequest.updateMany({
        where: { id, organizationId, status: { in: ["APPROVED", "PAYOUT_FAILED"] } },
        data: { status: "PAID", paidById: actingUserId, paidAt: new Date(), paymentReference: paymentReference ?? null },
      });
      if (cas.count === 0) {
        throw new ConflictException("Only an approved (or failed-payout) request can be marked paid");
      }
      const request = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id } });
      await this.applyPaidSideEffects(tx, request);
      return request;
    });
    return toWithdrawalResponse(updated);
  }

  // --- Gateway payout (RazorpayX) --------------------------------------
  // Called by PayoutGatewayService after it creates the transfer on
  // RazorpayX's side — this is where the CAS + DB write happens, mirroring
  // how PaymentGatewayService.verifyAndRecord hands off to
  // PaymentsService.recordGatewayPayment for the collection-side gateway.

  async markPayoutProcessing(
    id: string,
    organizationId: string,
    actorId: string,
    gatewayIds: {
      payoutGatewayContactId: string;
      payoutGatewayFundAccountId: string;
      payoutGatewayPayoutId: string;
    },
  ): Promise<WithdrawalRequestResponse> {
    await this.assertMemberPayoutEligible(
      (await this.findScoped(id, organizationId)).memberId,
    );
    const cas = await this.prisma.withdrawalRequest.updateMany({
      where: { id, organizationId, status: { in: ["APPROVED", "PAYOUT_FAILED"] } },
      data: {
        status: "PAYOUT_PROCESSING",
        payoutInitiatedById: actorId,
        payoutInitiatedAt: new Date(),
        payoutFailureReason: null,
        ...gatewayIds,
      },
    });
    if (cas.count === 0) {
      throw new ConflictException("Only an approved (or failed-payout) request can have a payout initiated");
    }
    return this.adminGet(id, organizationId);
  }

  // Looked up by the gateway's payout id, not our own id — the caller is a
  // webhook (or the manual status check) that only knows RazorpayX's id.
  // Returns null rather than throwing on a stale/duplicate webhook delivery
  // (already PAID, or the id doesn't match any request) so the caller can
  // no-op instead of treating a redelivery as an error.
  async markPaidFromPayout(payoutGatewayPayoutId: string, utr: string | null): Promise<WithdrawalRequestResponse | null> {
    const existing = await this.prisma.withdrawalRequest.findUnique({ where: { payoutGatewayPayoutId } });
    if (!existing) {
      return null;
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.withdrawalRequest.updateMany({
        where: { id: existing.id, status: "PAYOUT_PROCESSING" },
        data: { status: "PAID", paidAt: new Date(), payoutGatewayUtr: utr },
      });
      if (cas.count === 0) {
        return null;
      }
      const request = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id: existing.id } });
      await this.applyPaidSideEffects(tx, request);
      return request;
    });
    return updated ? toWithdrawalResponse(updated) : null;
  }

  async markPayoutFailed(payoutGatewayPayoutId: string, reason: string): Promise<WithdrawalRequestResponse | null> {
    const cas = await this.prisma.withdrawalRequest.updateMany({
      where: { payoutGatewayPayoutId, status: "PAYOUT_PROCESSING" },
      data: { status: "PAYOUT_FAILED", payoutFailureReason: reason },
    });
    if (cas.count === 0) {
      return null;
    }
    const request = await this.prisma.withdrawalRequest.findUniqueOrThrow({ where: { payoutGatewayPayoutId } });
    return toWithdrawalResponse(request);
  }

  // Shared by markPaid() and markPaidFromPayout() — both land on PAID via
  // different triggers (manual vs gateway webhook) but need the identical
  // accounting: net the spent points out of the member's balance and record
  // the ledger entry.
  private async applyPaidSideEffects(
    tx: Prisma.TransactionClient,
    request: {
      id: string;
      organizationId: string;
      memberId: string;
      pointsRequested: number;
      netAmount: Prisma.Decimal;
    },
  ): Promise<void> {
    await tx.member.update({
      where: { id: request.memberId },
      data: {
        pointsConverted: { increment: request.pointsRequested },
        totalWithdrawnAmount: { increment: request.netAmount },
      },
    });
    await tx.referralPointsLedger.create({
      data: {
        organizationId: request.organizationId,
        memberId: request.memberId,
        points: -request.pointsRequested,
        reason: "WITHDRAWAL_CONVERTED",
        status: "CONVERTED",
        relatedWithdrawalRequestId: request.id,
      },
    });
  }

  private async findScoped(id: string, organizationId: string) {
    const row = await this.prisma.withdrawalRequest.findFirst({
      where: { id, organizationId },
      include: { member: { select: { fullName: true } } },
    });
    if (!row) {
      throw new NotFoundException("Withdrawal request not found");
    }
    return row;
  }

  // Guard against paying out a member whose membership has since been
  // suspended or marked deceased — a request created while they were ACTIVE
  // must not be settled into a fraudulent/terminal account state. Public so
  // PayoutGatewayService can check this *before* it creates the RazorpayX
  // transfer — checking only inside markPayoutProcessing() is too late, since
  // that runs after the external payout has already been created there.
  async assertMemberPayoutEligible(memberId: string): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { status: true },
    });
    if (!member || member.status === "SUSPENDED" || member.status === "DECEASED" || member.status === "REJECTED") {
      throw new ConflictException("This member is not eligible to receive a withdrawal payout right now");
    }
  }

  // Reveals the bank account number snapshotted on the withdrawal request at
  // creation time — the authoritative destination for any manual payout. This
  // is distinct from KycService.revealBankAccountNumber, which reads the
  // member's *current* KYC record and must not be used to pay an approved
  // request (the account may have changed since).
  async revealPayoutBankAccount(id: string, organizationId: string): Promise<{ bankAccountNumber: string }> {
    const row = await this.prisma.withdrawalRequest.findFirst({
      where: { id, organizationId },
      select: { payoutBankAccountNumberEncrypted: true },
    });
    if (!row) {
      throw new NotFoundException("Withdrawal request not found");
    }
    if (!row.payoutBankAccountNumberEncrypted) {
      throw new NotFoundException("No bank account on file for this withdrawal");
    }
    return { bankAccountNumber: this.crypto.decrypt(row.payoutBankAccountNumberEncrypted) };
  }

  private async getSettings(
    organizationId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<WithdrawalSettings> {
    return tx.orgSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }
}
