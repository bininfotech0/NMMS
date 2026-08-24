import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser, DonationResponse, DonationStatus, RecordDonationInput, SubmitDonationInput } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NumberingService } from "../common/numbering.service";
import { buildJurisdictionWhere } from "../common/scope.util";
import { ReferralsService } from "../referrals/referrals.service";
import { toDonationResponse } from "./donation.mapper";

@Injectable()
export class DonationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly referrals: ReferralsService,
  ) {}

  // Member self-submission — a claim about money already sent outside the
  // app. Starts PENDING; points are locked in now (see
  // ReferralsService.recordPendingDonationPoints) but not credited to the
  // wallet, and no receipt is issued, until Field Executive/Admin review
  // (see approve/reject below).
  async submitMine(memberId: string, dto: SubmitDonationInput): Promise<DonationResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const settings = await this.getSettings(member.organizationId);
    const pointsAwarded = this.computePoints(dto.amount, settings.donationPointsPercent);

    const donation = await this.prisma.donation.create({
      data: {
        organizationId: member.organizationId,
        memberId,
        amount: dto.amount,
        mode: dto.mode,
        note: dto.note ?? null,
        reference: dto.reference ?? null,
        donorAddress: dto.donorAddress ?? null,
        donorPan: dto.donorPan ?? null,
        pointsAwarded,
      },
    });
    await this.referrals.recordPendingDonationPoints(member.organizationId, memberId, donation.id, pointsAwarded);
    return toDonationResponse(donation);
  }

  async listMine(memberId: string): Promise<DonationResponse[]> {
    const rows = await this.prisma.donation.findMany({ where: { memberId }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => toDonationResponse(r));
  }

  // Field Executive/Admin recording a donation received in person — no
  // @Roles() restriction, jurisdiction-scoped via buildJurisdictionWhere,
  // mirrors PaymentsService.recordPayment exactly. Auto-approved (staff is
  // already vouching for receipt), unlike a member's own submission.
  async recordDirect(memberId: string, dto: RecordDonationInput, user: AuthUser): Promise<DonationResponse> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }

    const settings = await this.getSettings(user.organizationId);
    const pointsAwarded = this.computePoints(dto.amount, settings.donationPointsPercent);

    const donation = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.numbering.nextDonationReceiptNumber(user.organizationId);
      const created = await tx.donation.create({
        data: {
          organizationId: user.organizationId,
          memberId,
          amount: dto.amount,
          mode: dto.mode,
          note: dto.note ?? null,
          reference: dto.reference ?? null,
          donorAddress: dto.donorAddress ?? null,
          donorPan: dto.donorPan ?? null,
          status: "APPROVED",
          receiptNumber,
          pointsAwarded,
          recordedById: user.id,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      await this.referrals.creditDonationPoints(tx, user.organizationId, memberId, pointsAwarded, created.id);
      return created;
    });
    return toDonationResponse(donation);
  }

  async findByMember(memberId: string, user: AuthUser): Promise<DonationResponse[]> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    const rows = await this.prisma.donation.findMany({ where: { memberId }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => toDonationResponse(r));
  }

  async adminList(organizationId: string, user: AuthUser, status?: DonationStatus): Promise<DonationResponse[]> {
    const rows = await this.prisma.donation.findMany({
      where: { organizationId, ...(status ? { status } : {}), member: buildJurisdictionWhere(user) },
      include: { member: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => toDonationResponse(r));
  }

  async adminGet(id: string, organizationId: string, user: AuthUser): Promise<DonationResponse> {
    return toDonationResponse(await this.findScoped(id, organizationId, user));
  }

  // CAS first (status PENDING -> APPROVED), only allocating the receipt
  // number *after* the CAS succeeds — a lost race (already approved/rejected
  // by someone else) must not burn a receipt sequence number, same ordering
  // PaymentsService.upgradePlan uses. Points were already locked in at
  // submission time (see ReferralsService.recordPendingDonationPoints) —
  // resolveDonation just flips that PENDING ledger row to APPROVED and
  // credits the wallet, same as resolveEventEvidence.
  //
  // findScoped's jurisdiction check below is what actually stops a Field
  // Executive (granted this endpoint via CAN_MANAGE_DONATIONS) from
  // approving a donation for a member outside members they created — it
  // 404s before the CAS below is ever reached.
  async approve(id: string, organizationId: string, reviewerId: string, user: AuthUser): Promise<DonationResponse> {
    await this.findScoped(id, organizationId, user);

    const donation = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.donation.updateMany({
        where: { id, organizationId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date() },
      });
      if (cas.count === 0) {
        throw new ConflictException("This donation is no longer pending — please refresh and try again");
      }
      const receiptNumber = await this.numbering.nextDonationReceiptNumber(organizationId);
      return tx.donation.update({ where: { id }, data: { receiptNumber } });
    });
    await this.referrals.resolveDonation(organizationId, donation.memberId, donation.id, true);
    return toDonationResponse(donation);
  }

  // Only a PENDING donation can be rejected — once APPROVED, points are
  // already credited and considered final (same finality as
  // REFERRAL_APPROVED); reversing one is a manual ledger adjustment, not a
  // reject action.
  async reject(
    id: string,
    organizationId: string,
    reviewerId: string,
    note: string,
    user: AuthUser,
  ): Promise<DonationResponse> {
    const existing = await this.findScoped(id, organizationId, user);
    const cas = await this.prisma.donation.updateMany({
      where: { id, organizationId, status: "PENDING" },
      data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note },
    });
    if (cas.count === 0) {
      throw new ConflictException("Only a pending donation can be rejected");
    }
    await this.referrals.resolveDonation(organizationId, existing.memberId, id, false);
    return this.adminGet(id, organizationId, user);
  }

  private computePoints(amount: number, percent: number): number {
    return Math.floor((amount * percent) / 100);
  }

  // Jurisdiction-scoped (not just org-scoped) — CAN_MANAGE_DONATIONS grants
  // FIELD_EXECUTIVE access to adminGet/approve/reject, so without this a FE
  // could act on a donation for a member outside the members they created,
  // the same guarantee adminList/findByMember already give via
  // buildJurisdictionWhere.
  private async findScoped(id: string, organizationId: string, user: AuthUser) {
    const row = await this.prisma.donation.findFirst({
      where: { id, organizationId, member: buildJurisdictionWhere(user) },
      include: { member: { select: { fullName: true } } },
    });
    if (!row) {
      throw new NotFoundException("Donation not found");
    }
    return row;
  }

  private async getSettings(organizationId: string) {
    return this.prisma.orgSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }
}
