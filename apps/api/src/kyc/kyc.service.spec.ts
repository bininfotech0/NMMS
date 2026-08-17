import { ConflictException, NotFoundException } from "@nestjs/common";
import { KycService } from "./kyc.service";
import { makeMember, makeMockPrisma } from "../test/fixtures";

function makeCrypto(overrides: Record<string, jest.Mock> = {}) {
  return {
    encrypt: jest.fn((plaintext: string) => `enc(${plaintext})`),
    decrypt: jest.fn((ciphertext: string) => ciphertext.replace(/^enc\(|\)$/g, "")),
    ...overrides,
  };
}

function makeService(prisma: ReturnType<typeof makeMockPrisma>, crypto = makeCrypto()) {
  return new KycService(prisma as never, crypto as never);
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    kycRequireAadhaar: true,
    kycRequirePan: false,
    kycRequireBankOrUpi: true,
    ...overrides,
  };
}

describe("KycService", () => {
  describe("isKycComplete", () => {
    const service = makeService(makeMockPrisma());

    it("requires fullName and mobile unconditionally", () => {
      const member = { fullName: "", mobile: "9800000000", aadhaarHash: "h", pan: null, payoutMethod: "UPI", bankAccountNumberEncrypted: null, bankIfscCode: null, upiId: "a@upi" };
      expect(service.isKycComplete(member, makeSettings())).toBe(false);
    });

    it("requires aadhaarHash when kycRequireAadhaar is true", () => {
      const member = { fullName: "A", mobile: "9800000000", aadhaarHash: null, pan: null, payoutMethod: "UPI", bankAccountNumberEncrypted: null, bankIfscCode: null, upiId: "a@upi" };
      expect(service.isKycComplete(member, makeSettings({ kycRequireAadhaar: true }))).toBe(false);
      expect(service.isKycComplete(member, makeSettings({ kycRequireAadhaar: false }))).toBe(true);
    });

    it("requires pan only when kycRequirePan is true", () => {
      const member = { fullName: "A", mobile: "9800000000", aadhaarHash: "h", pan: null, payoutMethod: "UPI", bankAccountNumberEncrypted: null, bankIfscCode: null, upiId: "a@upi" };
      expect(service.isKycComplete(member, makeSettings({ kycRequirePan: false }))).toBe(true);
      expect(service.isKycComplete(member, makeSettings({ kycRequirePan: true }))).toBe(false);
    });

    it("accepts either bank details or UPI for the bank-or-upi requirement", () => {
      const bankMember = { fullName: "A", mobile: "9800000000", aadhaarHash: "h", pan: null, payoutMethod: "BANK", bankAccountNumberEncrypted: "enc", bankIfscCode: "IFSC0001", upiId: null };
      const upiMember = { fullName: "A", mobile: "9800000000", aadhaarHash: "h", pan: null, payoutMethod: "UPI", bankAccountNumberEncrypted: null, bankIfscCode: null, upiId: "a@upi" };
      const neitherMember = { fullName: "A", mobile: "9800000000", aadhaarHash: "h", pan: null, payoutMethod: null, bankAccountNumberEncrypted: null, bankIfscCode: null, upiId: null };
      expect(service.isKycComplete(bankMember, makeSettings())).toBe(true);
      expect(service.isKycComplete(upiMember, makeSettings())).toBe(true);
      expect(service.isKycComplete(neitherMember, makeSettings())).toBe(false);
    });

    it("requires both accountNumber and ifsc for a bank submission to count", () => {
      const partial = { fullName: "A", mobile: "9800000000", aadhaarHash: "h", pan: null, payoutMethod: "BANK", bankAccountNumberEncrypted: "enc", bankIfscCode: null, upiId: null };
      expect(service.isKycComplete(partial, makeSettings())).toBe(false);
    });
  });

  describe("submitKyc", () => {
    it("encrypts the bank account number and stores only the last 4 digits", async () => {
      const prisma = makeMockPrisma();
      const crypto = makeCrypto();
      const service = makeService(prisma, crypto);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember());
      prisma.member.update.mockResolvedValue(makeMember({ kycStatus: "PENDING" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await service.submitKyc("member-1", {
        payoutMethod: "BANK",
        bankAccountName: "Ramesh Kumar",
        bankAccountNumber: "1234567890123456",
        bankIfscCode: "SBIN0001234",
        bankName: "State Bank of India",
      });

      expect(crypto.encrypt).toHaveBeenCalledWith("1234567890123456");
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "member-1" },
        data: expect.objectContaining({
          bankAccountNumberEncrypted: "enc(1234567890123456)",
          bankAccountNumberLast4: "3456",
          kycStatus: "PENDING",
        }),
      });
    });

    it("reverts an already-VERIFIED member to PENDING on resubmit", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ kycStatus: "VERIFIED" }));
      prisma.member.update.mockResolvedValue(makeMember({ kycStatus: "PENDING" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await service.submitKyc("member-1", { payoutMethod: "UPI", upiId: "ramesh@upi" });

      expect(prisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycStatus: "PENDING",
            kycReviewedById: null,
            kycReviewedAt: null,
            kycReviewNote: null,
          }),
        }),
      );
    });

    it("clears bank fields when switching to UPI", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember());
      prisma.member.update.mockResolvedValue(makeMember());
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await service.submitKyc("member-1", { payoutMethod: "UPI", upiId: "ramesh@upi" });

      expect(prisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            upiId: "ramesh@upi",
            bankAccountName: null,
            bankAccountNumberEncrypted: null,
            bankAccountNumberLast4: null,
            bankIfscCode: null,
            bankName: null,
          }),
        }),
      );
    });
  });

  describe("updateKycAsAdmin", () => {
    it("lets staff enter payout details on a member's behalf, landing back in PENDING for review", async () => {
      const prisma = makeMockPrisma();
      const crypto = makeCrypto();
      const service = makeService(prisma, crypto);
      prisma.member.findFirst.mockResolvedValue(makeMember({ organizationId: "org-1", kycStatus: "REJECTED" }));
      prisma.member.update.mockResolvedValue(makeMember({ kycStatus: "PENDING" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await service.updateKycAsAdmin("member-1", "org-1", {
        payoutMethod: "BANK",
        bankAccountName: "Ramesh Kumar",
        bankAccountNumber: "1234567890123456",
        bankIfscCode: "SBIN0001234",
      });

      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: { id: "member-1", organizationId: "org-1" },
      });
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "member-1" },
        data: expect.objectContaining({
          bankAccountNumberEncrypted: "enc(1234567890123456)",
          kycStatus: "PENDING",
          kycReviewedById: null,
        }),
      });
    });

    it("404s when the member doesn't belong to the admin's org", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(
        service.updateKycAsAdmin("member-1", "org-1", { payoutMethod: "UPI", upiId: "a@upi" }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });
  });

  describe("verify", () => {
    it("verifies a PENDING submission", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ kycStatus: "PENDING" }));
      prisma.member.update.mockResolvedValue(makeMember({ kycStatus: "VERIFIED" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      const result = await service.verify("member-1", "org-1", "admin-1");

      expect(result.kycStatus).toBe("VERIFIED");
      expect(prisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kycStatus: "VERIFIED", kycReviewedById: "admin-1" }),
        }),
      );
    });

    it("refuses to verify a submission that isn't PENDING", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ kycStatus: "NOT_SUBMITTED" }));

      await expect(service.verify("member-1", "org-1", "admin-1")).rejects.toThrow(ConflictException);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("404s when the member doesn't exist in this org", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(service.verify("member-1", "org-1", "admin-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("reject", () => {
    it("rejects a PENDING submission with a note", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ kycStatus: "PENDING" }));
      prisma.member.update.mockResolvedValue(makeMember({ kycStatus: "REJECTED" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await service.reject("member-1", "org-1", "admin-1", "Blurry document");

      expect(prisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kycStatus: "REJECTED", kycReviewNote: "Blurry document" }),
        }),
      );
    });

    it("refuses to reject a submission that isn't PENDING", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ kycStatus: "VERIFIED" }));

      await expect(service.reject("member-1", "org-1", "admin-1", "note")).rejects.toThrow(ConflictException);
    });
  });

  describe("revealBankAccountNumber", () => {
    it("decrypts and returns the stored account number", async () => {
      const prisma = makeMockPrisma();
      const crypto = makeCrypto();
      const service = makeService(prisma, crypto);
      prisma.member.findFirst.mockResolvedValue(
        makeMember({ bankAccountNumberEncrypted: "enc(1234567890123456)" }),
      );

      const result = await service.revealBankAccountNumber("member-1", "org-1");

      expect(crypto.decrypt).toHaveBeenCalledWith("enc(1234567890123456)");
      expect(result.bankAccountNumber).toBe("1234567890123456");
    });

    it("404s when there's no bank account on file", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ bankAccountNumberEncrypted: null }));

      await expect(service.revealBankAccountNumber("member-1", "org-1")).rejects.toThrow(NotFoundException);
    });
  });
});
