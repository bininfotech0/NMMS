import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { OrgProfile, PublicOrg, UpdateOrgInput } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic(): Promise<PublicOrg> {
    const org = await this.prisma.organization.findFirst({ include: { settings: true } });
    if (!org) {
      throw new NotFoundException("Organization is not configured yet");
    }
    return { name: org.name, logoUrl: org.settings?.logoUrl ?? null };
  }

  async getProfile(organizationId: string): Promise<OrgProfile> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const settings = await this.ensureSettings(organizationId);
    return this.toOrgProfile(org, settings);
  }

  async update(organizationId: string, dto: UpdateOrgInput): Promise<OrgProfile> {
    const { name, ...settingsFields } = dto;

    const org = name
      ? await this.prisma.organization.update({ where: { id: organizationId }, data: { name } })
      : await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

    const existingSettings = await this.ensureSettings(organizationId);
    // Each field validates independently in updateOrgSchema (a PATCH can send
    // just one of a pair), so the only place that can see the *effective*
    // combination — this field's new value alongside the other's current or
    // new value — is here, after merging onto what's already stored.
    const effectiveChargeType = settingsFields.withdrawalChargeType ?? existingSettings.withdrawalChargeType;
    const effectiveChargeValue =
      settingsFields.withdrawalChargeValue ?? existingSettings.withdrawalChargeValue.toNumber();
    if (effectiveChargeType === "PERCENTAGE" && effectiveChargeValue > 100) {
      throw new BadRequestException("A percentage withdrawal charge cannot exceed 100%");
    }
    const effectiveMinAmount =
      settingsFields.withdrawalMinAmount ?? existingSettings.withdrawalMinAmount.toNumber();
    const effectiveMaxAmount =
      settingsFields.withdrawalMaxAmount !== undefined
        ? settingsFields.withdrawalMaxAmount
        : (existingSettings.withdrawalMaxAmount?.toNumber() ?? null);
    if (effectiveMaxAmount != null && effectiveMinAmount > effectiveMaxAmount) {
      throw new BadRequestException("Minimum withdrawal amount cannot be greater than the maximum");
    }

    const settings = await this.prisma.orgSettings.update({
      where: { organizationId },
      data: settingsFields,
    });

    return this.toOrgProfile(org, settings);
  }

  private async ensureSettings(organizationId: string) {
    return this.prisma.orgSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  private toOrgProfile(
    org: { id: string; name: string },
    settings: {
      logoUrl: string | null;
      address: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      bankAccountName: string | null;
      bankAccountNumber: string | null;
      bankIfscCode: string | null;
      bankName: string | null;
      membershipNumberFormat: string;
      receiptNumberFormat: string;
      referralProgramEnabled: boolean;
      pointsPerApprovedReferral: number;
      referralPointsCapPerMember: number | null;
      referralRequireActiveReferrerPlan: boolean;
      pointsToMoneyRatioPoints: number;
      pointsToMoneyRatioAmount: Prisma.Decimal;
      kycRequireAadhaar: boolean;
      kycRequirePan: boolean;
      kycRequireBankOrUpi: boolean;
      withdrawalMinAmount: Prisma.Decimal;
      withdrawalMaxAmount: Prisma.Decimal | null;
      withdrawalFrequencyDays: number | null;
      withdrawalChargeType: string;
      withdrawalChargeValue: Prisma.Decimal;
      donationPointsPercent: number;
    },
  ): OrgProfile {
    return {
      id: org.id,
      name: org.name,
      logoUrl: settings.logoUrl,
      address: settings.address,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      bankAccountName: settings.bankAccountName,
      bankAccountNumber: settings.bankAccountNumber,
      bankIfscCode: settings.bankIfscCode,
      bankName: settings.bankName,
      membershipNumberFormat: settings.membershipNumberFormat,
      receiptNumberFormat: settings.receiptNumberFormat,
      referralProgramEnabled: settings.referralProgramEnabled,
      pointsPerApprovedReferral: settings.pointsPerApprovedReferral,
      referralPointsCapPerMember: settings.referralPointsCapPerMember,
      referralRequireActiveReferrerPlan: settings.referralRequireActiveReferrerPlan,
      pointsToMoneyRatioPoints: settings.pointsToMoneyRatioPoints,
      pointsToMoneyRatioAmount: settings.pointsToMoneyRatioAmount.toNumber(),
      kycRequireAadhaar: settings.kycRequireAadhaar,
      kycRequirePan: settings.kycRequirePan,
      kycRequireBankOrUpi: settings.kycRequireBankOrUpi,
      withdrawalMinAmount: settings.withdrawalMinAmount.toNumber(),
      withdrawalMaxAmount: settings.withdrawalMaxAmount?.toNumber() ?? null,
      withdrawalFrequencyDays: settings.withdrawalFrequencyDays,
      withdrawalChargeType: settings.withdrawalChargeType as OrgProfile["withdrawalChargeType"],
      withdrawalChargeValue: settings.withdrawalChargeValue.toNumber(),
      donationPointsPercent: settings.donationPointsPercent,
    };
  }
}
