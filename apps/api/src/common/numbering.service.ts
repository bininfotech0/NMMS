import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  // Atomically increments the org's sequence counter (row-level lock on the
  // UPDATE serializes concurrent approvals) and formats it per OrgSettings.
  async nextMembershipNumber(organizationId: string): Promise<string> {
    const settings = await this.prisma.orgSettings.upsert({
      where: { organizationId },
      create: { organizationId, lastMembershipSeq: 1 },
      update: { lastMembershipSeq: { increment: 1 } },
    });

    const year = new Date().getFullYear().toString();
    const seq = String(settings.lastMembershipSeq).padStart(5, "0");

    return settings.membershipNumberFormat
      .replace("{PREFIX}", settings.membershipNumberPrefix)
      .replace("{YYYY}", year)
      .replace("{SEQ}", seq);
  }

  async nextReceiptNumber(organizationId: string): Promise<string> {
    const settings = await this.prisma.orgSettings.upsert({
      where: { organizationId },
      create: { organizationId, lastReceiptSeq: 1 },
      update: { lastReceiptSeq: { increment: 1 } },
    });

    const year = new Date().getFullYear().toString();
    const seq = String(settings.lastReceiptSeq).padStart(5, "0");

    return settings.receiptNumberFormat
      .replace("{PREFIX}", settings.receiptNumberPrefix)
      .replace("{YYYY}", year)
      .replace("{SEQ}", seq);
  }

  async nextRegistrationNumber(organizationId: string): Promise<string> {
    const settings = await this.prisma.orgSettings.upsert({
      where: { organizationId },
      create: { organizationId, lastRegistrationSeq: 1 },
      update: { lastRegistrationSeq: { increment: 1 } },
    });

    const year = new Date().getFullYear().toString();
    const seq = String(settings.lastRegistrationSeq).padStart(5, "0");

    return settings.registrationNumberFormat
      .replace("{PREFIX}", settings.registrationNumberPrefix)
      .replace("{YYYY}", year)
      .replace("{SEQ}", seq);
  }
}
