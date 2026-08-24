import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type SeqField = "lastMembershipSeq" | "lastReceiptSeq" | "lastDonationReceiptSeq" | "lastRegistrationSeq";
type FormatField = "membershipNumberFormat" | "receiptNumberFormat" | "donationReceiptNumberFormat" | "registrationNumberFormat";
type PrefixField = "membershipNumberPrefix" | "receiptNumberPrefix" | "donationReceiptNumberPrefix" | "registrationNumberPrefix";

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async nextMembershipNumber(organizationId: string): Promise<string> {
    return this.next(organizationId, "lastMembershipSeq", "membershipNumberFormat", "membershipNumberPrefix");
  }

  async nextReceiptNumber(organizationId: string): Promise<string> {
    return this.next(organizationId, "lastReceiptSeq", "receiptNumberFormat", "receiptNumberPrefix");
  }

  async nextDonationReceiptNumber(organizationId: string): Promise<string> {
    return this.next(
      organizationId,
      "lastDonationReceiptSeq",
      "donationReceiptNumberFormat",
      "donationReceiptNumberPrefix",
    );
  }

  async nextRegistrationNumber(organizationId: string): Promise<string> {
    return this.next(organizationId, "lastRegistrationSeq", "registrationNumberFormat", "registrationNumberPrefix");
  }

  // Atomically increments the org's sequence counter (row-level lock on the
  // UPDATE serializes concurrent approvals) and formats it per OrgSettings —
  // shared by all four sequence kinds above, which differ only in which
  // seq/format/prefix column they read.
  private async next(
    organizationId: string,
    seqField: SeqField,
    formatField: FormatField,
    prefixField: PrefixField,
  ): Promise<string> {
    const settings = await this.prisma.orgSettings.upsert({
      where: { organizationId },
      create: { organizationId, [seqField]: 1 },
      update: { [seqField]: { increment: 1 } },
    });

    const year = new Date().getFullYear().toString();
    const seq = String(settings[seqField]).padStart(5, "0");

    return (settings[formatField] as string)
      .replace("{PREFIX}", settings[prefixField] as string)
      .replace("{YYYY}", year)
      .replace("{SEQ}", seq);
  }
}
