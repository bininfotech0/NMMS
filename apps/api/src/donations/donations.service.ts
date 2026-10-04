import { Injectable, NotFoundException } from "@nestjs/common";
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

  // Member submissions are accepted immediately without a staff review step.
  async submitMine(memberId: string, dto: SubmitDonationInput): Promise<DonationResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const settings = await this.getSettings(member.organizationId);
    const pointsAwarded = this.computePoints(dto.amount, settings.donationPointsPercent);
    const receiptNumber = await this.numbering.nextDonationReceiptNumber(member.organizationId);

    const donation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.donation.create({
        data: {
          organizationId: member.organizationId,
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
        },
      });
      await this.referrals.creditDonationPoints(tx, member.organizationId, memberId, pointsAwarded, created.id);
      return created;
    });
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

  private computePoints(amount: number, percent: number): number {
    return Math.floor((amount * percent) / 100);
  }

  // Jurisdiction-scoped (not just org-scoped) — Field Executives can view only
  // donations for members they created, matching adminList/findByMember.
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
