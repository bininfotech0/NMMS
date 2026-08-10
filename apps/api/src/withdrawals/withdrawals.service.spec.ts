import { Prisma } from "@prisma/client";
import { ConflictException } from "@nestjs/common";
import { WithdrawalsService } from "./withdrawals.service";
import { makeMember, makeMockPrisma, makeWithdrawalRequest } from "../test/fixtures";

function makeKyc(overrides: Record<string, jest.Mock> = {}) {
  return {
    isKycComplete: jest.fn().mockReturnValue(true),
    ...overrides,
  };
}

function makeService(prisma: ReturnType<typeof makeMockPrisma>, kyc = makeKyc()) {
  return new WithdrawalsService(prisma as never, kyc as never);
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    pointsToMoneyRatioPoints: 100,
    pointsToMoneyRatioAmount: new Prisma.Decimal(10),
    withdrawalMinAmount: new Prisma.Decimal(10),
    withdrawalMaxAmount: null as Prisma.Decimal | null,
    withdrawalFrequencyDays: null as number | null,
    withdrawalChargeType: "NONE",
    withdrawalChargeValue: new Prisma.Decimal(0),
    kycRequireAadhaar: true,
    kycRequirePan: false,
    kycRequireBankOrUpi: true,
    ...overrides,
  };
}

describe("WithdrawalsService", () => {
  describe("createRequest", () => {
    it("rejects when the member's KYC is not VERIFIED", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ kycStatus: "PENDING" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await expect(service.createRequest("member-1", { pointsRequested: 100 })).rejects.toThrow(ConflictException);
      expect(prisma.withdrawalRequest.create).not.toHaveBeenCalled();
    });

    it("rejects when KYC requirements have tightened since verification", async () => {
      const prisma = makeMockPrisma();
      const kyc = makeKyc({ isKycComplete: jest.fn().mockReturnValue(false) });
      const service = makeService(prisma, kyc);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ kycStatus: "VERIFIED" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await expect(service.createRequest("member-1", { pointsRequested: 100 })).rejects.toThrow(ConflictException);
    });

    it("rejects a request below the minimum withdrawal amount", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 1000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ withdrawalMinAmount: new Prisma.Decimal(50) }));

      // 10 points -> gross ₹1, below the ₹50 minimum
      await expect(service.createRequest("member-1", { pointsRequested: 10 })).rejects.toThrow(ConflictException);
    });

    it("rejects a request above the maximum withdrawal amount when set", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 100000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ withdrawalMaxAmount: new Prisma.Decimal(100) }));

      // 100000 points -> gross ₹10000, above the ₹100 maximum
      await expect(service.createRequest("member-1", { pointsRequested: 100000 })).rejects.toThrow(ConflictException);
    });

    it("allows an unlimited maximum when withdrawalMaxAmount is null", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 100000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ withdrawalMaxAmount: null }));
      prisma.withdrawalRequest.groupBy.mockResolvedValue([]);
      prisma.withdrawalRequest.create.mockResolvedValue(makeWithdrawalRequest());

      await expect(service.createRequest("member-1", { pointsRequested: 100000 })).resolves.toBeDefined();
    });

    it("rejects a second request within the configured frequency window", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 1000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ withdrawalFrequencyDays: 30 }));
      prisma.withdrawalRequest.findFirst.mockResolvedValue(
        makeWithdrawalRequest({ status: "APPROVED", createdAt: new Date() }),
      );

      await expect(service.createRequest("member-1", { pointsRequested: 100 })).rejects.toThrow(ConflictException);
    });

    it("does not count a REJECTED request against the frequency window", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 1000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ withdrawalFrequencyDays: 30 }));
      // findFirst is called with status: { not: "REJECTED" } — simulate no matching row.
      prisma.withdrawalRequest.findFirst.mockResolvedValue(null);
      prisma.withdrawalRequest.groupBy.mockResolvedValue([]);
      prisma.withdrawalRequest.create.mockResolvedValue(makeWithdrawalRequest());

      await expect(service.createRequest("member-1", { pointsRequested: 100 })).resolves.toBeDefined();
    });

    it("allows a request when withdrawalFrequencyDays is null", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 1000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ withdrawalFrequencyDays: null }));
      prisma.withdrawalRequest.groupBy.mockResolvedValue([]);
      prisma.withdrawalRequest.create.mockResolvedValue(makeWithdrawalRequest());

      await expect(service.createRequest("member-1", { pointsRequested: 100 })).resolves.toBeDefined();
      expect(prisma.withdrawalRequest.findFirst).not.toHaveBeenCalled();
    });

    it("rejects when pointsRequested exceeds the available balance", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 100, pointsConverted: 0 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      // 50 points already locked in an open PENDING request.
      prisma.withdrawalRequest.groupBy.mockResolvedValue([
        { status: "PENDING", _sum: { pointsRequested: 50 } },
      ]);

      // Available = 100 - 0 - 50 - 0 = 50; requesting 60 should fail.
      await expect(service.createRequest("member-1", { pointsRequested: 60 })).rejects.toThrow(ConflictException);
    });

    it.each([
      ["NONE", 0, 10, 10],
      ["FLAT", 5, 10, 5],
      ["PERCENTAGE", 10, 10, 9],
    ])("computes %s charges correctly", async (chargeType, chargeValue, grossPoints, expectedNet) => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 1000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(
        makeSettings({ withdrawalChargeType: chargeType, withdrawalChargeValue: new Prisma.Decimal(chargeValue) }),
      );
      prisma.withdrawalRequest.groupBy.mockResolvedValue([]);
      prisma.withdrawalRequest.create.mockResolvedValue(makeWithdrawalRequest());

      // grossPoints points at ratio 100pts=₹10 -> gross = grossPoints/10
      await service.createRequest("member-1", { pointsRequested: grossPoints * 10 });

      const createCall = prisma.withdrawalRequest.create.mock.calls[0][0];
      expect(createCall.data.netAmount.toNumber()).toBeCloseTo(expectedNet);
    });

    it("clamps a FLAT charge that exceeds the gross amount to the gross amount", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ kycStatus: "VERIFIED", referralPointsBalance: 1000 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(
        makeSettings({ withdrawalMinAmount: new Prisma.Decimal(0), withdrawalChargeType: "FLAT", withdrawalChargeValue: new Prisma.Decimal(100) }),
      );
      prisma.withdrawalRequest.groupBy.mockResolvedValue([]);
      prisma.withdrawalRequest.create.mockResolvedValue(makeWithdrawalRequest());

      // 100 points -> gross ₹10, FLAT charge of ₹100 clamps to ₹10, net = ₹0.
      await service.createRequest("member-1", { pointsRequested: 100 });

      const createCall = prisma.withdrawalRequest.create.mock.calls[0][0];
      expect(createCall.data.chargeAmount.toNumber()).toBe(10);
      expect(createCall.data.netAmount.toNumber()).toBe(0);
    });

    it("snapshots the member's current payout method and masked details", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({
          kycStatus: "VERIFIED",
          referralPointsBalance: 1000,
          payoutMethod: "UPI",
          upiId: "ramesh@upi",
        }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.withdrawalRequest.groupBy.mockResolvedValue([]);
      prisma.withdrawalRequest.create.mockResolvedValue(makeWithdrawalRequest());

      await service.createRequest("member-1", { pointsRequested: 100 });

      expect(prisma.withdrawalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payoutMethod: "UPI", payoutUpiId: "ramesh@upi" }),
        }),
      );
    });
  });

  describe("approve", () => {
    it("approves a PENDING request", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.withdrawalRequest.findFirst.mockResolvedValue(makeWithdrawalRequest({ status: "PENDING" }));
      prisma.withdrawalRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.approve("withdrawal-1", "org-1", "admin-1");

      expect(prisma.withdrawalRequest.updateMany).toHaveBeenCalledWith({
        where: { id: "withdrawal-1", organizationId: "org-1", status: "PENDING" },
        data: expect.objectContaining({ status: "APPROVED", reviewedById: "admin-1" }),
      });
    });

    it("refuses to approve a request that's no longer PENDING (double-processing race)", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.withdrawalRequest.findFirst.mockResolvedValue(makeWithdrawalRequest({ status: "PENDING" }));
      // Simulates a concurrent approve() having already won the CAS race.
      prisma.withdrawalRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.approve("withdrawal-1", "org-1", "admin-1")).rejects.toThrow(ConflictException);
    });
  });

  describe("reject", () => {
    it("rejects from PENDING", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.withdrawalRequest.findFirst.mockResolvedValue(makeWithdrawalRequest({ status: "PENDING" }));
      prisma.withdrawalRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.reject("withdrawal-1", "org-1", "admin-1", "Insufficient balance verification");

      expect(prisma.withdrawalRequest.updateMany).toHaveBeenCalledWith({
        where: { id: "withdrawal-1", organizationId: "org-1", status: { in: ["PENDING", "APPROVED"] } },
        data: expect.objectContaining({ status: "REJECTED", reviewNote: "Insufficient balance verification" }),
      });
    });

    it("rejects from APPROVED (backing out before payment)", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.withdrawalRequest.findFirst.mockResolvedValue(makeWithdrawalRequest({ status: "APPROVED" }));
      prisma.withdrawalRequest.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.reject("withdrawal-1", "org-1", "admin-1", "Problem found")).resolves.toBeDefined();
    });

    it("refuses to reject a REJECTED or PAID request", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.withdrawalRequest.findFirst.mockResolvedValue(makeWithdrawalRequest({ status: "PAID" }));
      prisma.withdrawalRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.reject("withdrawal-1", "org-1", "admin-1", "note")).rejects.toThrow(ConflictException);
    });
  });

  describe("markPaid", () => {
    it("pays out an APPROVED request and credits the member's cached balances + ledger", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.withdrawalRequest.findFirst.mockResolvedValue(makeWithdrawalRequest({ status: "APPROVED" }));
      prisma.withdrawalRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(
        makeWithdrawalRequest({ status: "PAID", pointsRequested: 100, netAmount: { toNumber: () => 10 } }),
      );

      await service.markPaid("withdrawal-1", "org-1", "admin-1", "UTR123");

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "member-1" },
        data: {
          pointsConverted: { increment: 100 },
          totalWithdrawnAmount: { increment: expect.anything() },
        },
      });
      expect(prisma.referralPointsLedger.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          memberId: "member-1",
          points: -100,
          reason: "WITHDRAWAL_CONVERTED",
          status: "CONVERTED",
          relatedWithdrawalRequestId: "withdrawal-1",
        },
      });
    });

    it("refuses to pay a request that isn't APPROVED", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.withdrawalRequest.findFirst.mockResolvedValue(makeWithdrawalRequest({ status: "PENDING" }));
      prisma.withdrawalRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markPaid("withdrawal-1", "org-1", "admin-1")).rejects.toThrow(ConflictException);
      expect(prisma.member.update).not.toHaveBeenCalled();
      expect(prisma.referralPointsLedger.create).not.toHaveBeenCalled();
    });
  });

  describe("getWalletSummary", () => {
    it("computes all six wallet fields from the member's cached balances and open requests", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({
          referralPointsBalance: 1000,
          pointsConverted: 100,
          totalWithdrawnAmount: { toNumber: () => 5 },
        }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.withdrawalRequest.groupBy.mockResolvedValue([
        { status: "PENDING", _sum: { pointsRequested: 200 } },
        { status: "APPROVED", _sum: { pointsRequested: 150 } },
      ]);

      const summary = await service.getWalletSummary("member-1");

      expect(summary).toEqual({
        earnedPoints: 1000,
        pendingPoints: 200,
        approvedPoints: 150,
        convertedPoints: 100,
        availableBalancePoints: 550,
        availableBalanceAmount: 55,
        withdrawnAmount: 5,
      });
    });
  });
});
