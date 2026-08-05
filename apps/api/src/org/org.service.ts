import { Injectable, NotFoundException } from "@nestjs/common";
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

    await this.ensureSettings(organizationId);
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
      referralSilverMinPoints: number;
      referralGoldMinPoints: number;
      referralPlatinumMinPoints: number;
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
      referralSilverMinPoints: settings.referralSilverMinPoints,
      referralGoldMinPoints: settings.referralGoldMinPoints,
      referralPlatinumMinPoints: settings.referralPlatinumMinPoints,
    };
  }
}
