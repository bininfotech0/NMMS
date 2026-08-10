import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateWithdrawalRequestInput,
  WalletSummaryResponse,
  WithdrawalChargeType,
  WithdrawalRequestResponse,
  WithdrawalStatus,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { KycService } from "../kyc/kyc.service";
import { toWithdrawalResponse } from "./withdrawal.mapper";

const OPEN_STATUSES = ["PENDING", "APPROVED"] as const;
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
  ) {}

  private computeGrossAmount(points: number, settings: WithdrawalSettings): Prisma.Decimal {
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
      chargeAmount = grossAmount.mul(settings.withdrawalChargeValue).div(100);
    }
    return { chargeType: settings.withdrawalChargeType, chargeAmount, netAmount: grossAmount.sub(chargeAmount) };
  }

  // Live sum of points locked in open (not yet PAID/REJECTED) requests —
  // small N per member, same live-aggregate idiom as ReferralsService's
  // applyReferralCap.
  private async getLockedPoints(
    tx: Prisma.TransactionClient,
    memberId: string,
  ): Promise<{ pending: number; approved: number }> {
    const rows = await tx.withdrawalRequest.groupBy({
      by: ["status"],
      where: { memberId, status: { in: [...OPEN_STATUSES] } },
      _sum: { pointsRequested: true },
    });
    const pending = rows.find((r) => r.status === "PENDING")?._sum.pointsRequested ?? 0;
    const approved = rows.find((r) => r.status === "APPROVED")?._sum.pointsRequested ?? 0;
    return { pending, approved };
  }

  async getWalletSummary(memberId: string): Promise<WalletSummaryResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const settings = await this.getSettings(member.organizationId);
    const { pending, approved } = await this.getLockedPoints(this.prisma, memberId);

    const earnedPoints = member.referralPointsBalance;
    const convertedPoints = member.pointsConverted;
    const availableBalancePoints = earnedPoints - convertedPoints - pending - approved;
    const availableBalanceAmount = this.computeGrossAmount(Math.max(availableBalancePoints, 0), settings).toNumber();

    return {
      earnedPoints,
      pendingPoints: pending,
      approvedPoints: approved,
      convertedPoints,
      availableBalancePoints,
      availableBalanceAmount,
      withdrawnAmount: member.totalWithdrawnAmount.toNumber(),
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

      const { pending, approved } = await this.getLockedPoints(tx, memberId);
      const availableBalance = member.referralPointsBalance - member.pointsConverted - pending - approved;
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
    await this.findScoped(id, organizationId);
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
    await this.findScoped(id, organizationId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.withdrawalRequest.updateMany({
        where: { id, organizationId, status: "APPROVED" },
        data: { status: "PAID", paidById: actingUserId, paidAt: new Date(), paymentReference: paymentReference ?? null },
      });
      if (cas.count === 0) {
        throw new ConflictException("Only an approved request can be marked paid");
      }
      const request = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id } });

      await tx.member.update({
        where: { id: request.memberId },
        data: {
          pointsConverted: { increment: request.pointsRequested },
          totalWithdrawnAmount: { increment: request.netAmount },
        },
      });
      await tx.referralPointsLedger.create({
        data: {
          organizationId,
          memberId: request.memberId,
          points: -request.pointsRequested,
          reason: "WITHDRAWAL_CONVERTED",
          status: "CONVERTED",
          relatedWithdrawalRequestId: request.id,
        },
      });

      return request;
    });
    return toWithdrawalResponse(updated);
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
