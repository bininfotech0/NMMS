import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { KycResponse, KycStatus, PayoutMethod, SubmitKycInput } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";

type KycMember = {
  fullName: string;
  mobile: string;
  aadhaarHash: string | null;
  pan: string | null;
  payoutMethod: string | null;
  bankAccountNumberEncrypted: string | null;
  bankIfscCode: string | null;
  upiId: string | null;
};

type KycSettings = {
  kycRequireAadhaar: boolean;
  kycRequirePan: boolean;
  kycRequireBankOrUpi: boolean;
};

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // Pure predicate — reused by WithdrawalsService's creation gate. Full Name
  // + Mobile are unconditionally required (createMemberSchema already
  // guarantees they're non-empty), so only the toggleable pieces are checked.
  isKycComplete(member: KycMember, settings: KycSettings): boolean {
    if (!member.fullName || !member.mobile) return false;
    if (settings.kycRequireAadhaar && !member.aadhaarHash) return false;
    if (settings.kycRequirePan && !member.pan) return false;
    if (settings.kycRequireBankOrUpi) {
      const hasBank = !!member.bankAccountNumberEncrypted && !!member.bankIfscCode;
      const hasUpi = !!member.upiId;
      if (!hasBank && !hasUpi) return false;
    }
    return true;
  }

  async getMyKyc(memberId: string): Promise<KycResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const settings = await this.getSettings(member.organizationId);
    return this.toKycResponse(member, settings);
  }

  async submitKyc(memberId: string, dto: SubmitKycInput): Promise<KycResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });

    const data: Prisma.MemberUncheckedUpdateInput = {
      payoutMethod: dto.payoutMethod,
      // kycStatus always moves to PENDING on submit — including from VERIFIED,
      // since changing payout destination must force re-review (see plan).
      kycStatus: "PENDING",
      kycReviewedById: null,
      kycReviewedAt: null,
      kycReviewNote: null,
    };

    if (dto.payoutMethod === "BANK") {
      data.bankAccountName = dto.bankAccountName;
      data.bankAccountNumberEncrypted = this.crypto.encrypt(dto.bankAccountNumber!);
      data.bankAccountNumberLast4 = dto.bankAccountNumber!.slice(-4);
      data.bankIfscCode = dto.bankIfscCode;
      data.bankName = dto.bankName ?? null;
      data.upiId = null;
    } else {
      data.upiId = dto.upiId;
      data.bankAccountName = null;
      data.bankAccountNumberEncrypted = null;
      data.bankAccountNumberLast4 = null;
      data.bankIfscCode = null;
      data.bankName = null;
    }

    const updated = await this.prisma.member.update({ where: { id: memberId }, data });
    const settings = await this.getSettings(member.organizationId);
    return this.toKycResponse(updated, settings);
  }

  async listForAdmin(organizationId: string, status?: KycStatus): Promise<KycResponse[]> {
    const members = await this.prisma.member.findMany({
      where: { organizationId, ...(status ? { kycStatus: status } : {}) },
      orderBy: { updatedAt: "desc" },
    });
    const settings = await this.getSettings(organizationId);
    return members.map((m) => this.toKycResponse(m, settings, true));
  }

  async getForAdmin(memberId: string, organizationId: string): Promise<KycResponse> {
    const member = await this.findScoped(memberId, organizationId);
    const settings = await this.getSettings(organizationId);
    return this.toKycResponse(member, settings, true);
  }

  async verify(memberId: string, organizationId: string, reviewerId: string): Promise<KycResponse> {
    const member = await this.findScoped(memberId, organizationId);
    if (member.kycStatus !== "PENDING") {
      throw new ConflictException("Only a PENDING KYC submission can be verified");
    }
    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: { kycStatus: "VERIFIED", kycReviewedById: reviewerId, kycReviewedAt: new Date(), kycReviewNote: null },
    });
    const settings = await this.getSettings(organizationId);
    return this.toKycResponse(updated, settings, true);
  }

  async reject(memberId: string, organizationId: string, reviewerId: string, note: string): Promise<KycResponse> {
    const member = await this.findScoped(memberId, organizationId);
    if (member.kycStatus !== "PENDING") {
      throw new ConflictException("Only a PENDING KYC submission can be rejected");
    }
    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: { kycStatus: "REJECTED", kycReviewedById: reviewerId, kycReviewedAt: new Date(), kycReviewNote: note },
    });
    const settings = await this.getSettings(organizationId);
    return this.toKycResponse(updated, settings, true);
  }

  async revealBankAccountNumber(memberId: string, organizationId: string): Promise<{ bankAccountNumber: string }> {
    const member = await this.findScoped(memberId, organizationId);
    if (!member.bankAccountNumberEncrypted) {
      throw new NotFoundException("No bank account on file for this member");
    }
    return { bankAccountNumber: this.crypto.decrypt(member.bankAccountNumberEncrypted) };
  }

  private async findScoped(memberId: string, organizationId: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, organizationId } });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    return member;
  }

  private async getSettings(organizationId: string): Promise<KycSettings> {
    return this.prisma.orgSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  private toKycResponse(
    member: {
      id: string;
      fullName: string;
      mobile: string;
      aadhaarHash: string | null;
      aadhaarLast4: string | null;
      pan: string | null;
      kycStatus: string;
      kycReviewedAt: Date | null;
      kycReviewNote: string | null;
      payoutMethod: string | null;
      bankAccountName: string | null;
      bankAccountNumberEncrypted: string | null;
      bankAccountNumberLast4: string | null;
      bankIfscCode: string | null;
      bankName: string | null;
      upiId: string | null;
    },
    settings: KycSettings,
    includeMemberInfo = false,
  ): KycResponse {
    return {
      ...(includeMemberInfo ? { memberId: member.id, memberName: member.fullName } : {}),
      kycStatus: member.kycStatus as KycResponse["kycStatus"],
      kycReviewedAt: member.kycReviewedAt,
      kycReviewNote: member.kycReviewNote,
      isComplete: this.isKycComplete(member, settings),
      payoutMethod: member.payoutMethod as PayoutMethod | null,
      bankAccountName: member.bankAccountName,
      bankAccountNumberLast4: member.bankAccountNumberLast4,
      bankIfscCode: member.bankIfscCode,
      bankName: member.bankName,
      upiId: member.upiId,
      aadhaarLast4: member.aadhaarLast4,
      pan: member.pan,
    };
  }
}
