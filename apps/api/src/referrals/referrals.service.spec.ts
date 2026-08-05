import { ConflictException } from "@nestjs/common";
import { ReferralsService } from "./referrals.service";
import { makeMember, makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  return new ReferralsService(prisma as never);
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    referralProgramEnabled: true,
    pointsPerApprovedReferral: 10,
    referralSilverMinPoints: 0,
    referralGoldMinPoints: 20,
    referralPlatinumMinPoints: 50,
    ...overrides,
  };
}

describe("ReferralsService", () => {
  describe("awardPointsForApproval", () => {
    it("does nothing when the approved member has no referrer", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique.mockResolvedValue(makeMember({ referralMemberId: null }));

      await service.awardPointsForApproval("member-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("does nothing when the referral program is disabled for the org", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique.mockResolvedValue(makeMember({ referralMemberId: "referrer-1" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ referralProgramEnabled: false }));

      await service.awardPointsForApproval("member-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("credits the referrer's points balance and writes a ledger entry", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique.mockResolvedValue(
        makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.member.update.mockResolvedValue(
        makeMember({ id: "referrer-1", referralPointsBalance: 10 }),
      );

      await service.awardPointsForApproval("member-1");

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "referrer-1" },
        data: { referralPointsBalance: { increment: 10 } },
      });
      expect(prisma.referralPointsLedger.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          memberId: "referrer-1",
          points: 10,
          reason: "REFERRAL_APPROVED",
          relatedMemberId: "member-1",
        },
      });
    });

    it("creates a PENDING reward the first time a rank threshold is crossed", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique.mockResolvedValue(
        makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      // Referrer crosses from 10 -> 20 points, which is exactly the GOLD threshold.
      prisma.member.update.mockResolvedValue(
        makeMember({ id: "referrer-1", referralPointsBalance: 20 }),
      );

      await service.awardPointsForApproval("member-1");

      // SILVER (min 0) and GOLD (min 20) both qualify at 20 points; PLATINUM (min 50) does not.
      expect(prisma.referralReward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId_rank: { memberId: "referrer-1", rank: "SILVER" } },
        }),
      );
      expect(prisma.referralReward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId_rank: { memberId: "referrer-1", rank: "GOLD" } },
        }),
      );
      expect(prisma.referralReward.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId_rank: { memberId: "referrer-1", rank: "PLATINUM" } },
        }),
      );
    });
  });

  describe("awardPointsForEventCompletion", () => {
    it("does nothing when pointsReward is zero or negative", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);

      await service.awardPointsForEventCompletion("org-1", "member-1", "reg-1", 0);

      expect(prisma.orgSettings.upsert).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("credits the member's own balance via the same ledger/reward machinery as referrals", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.member.update.mockResolvedValue(makeMember({ id: "member-1", referralPointsBalance: 15 }));

      await service.awardPointsForEventCompletion("org-1", "member-1", "reg-1", 15);

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "member-1" },
        data: { referralPointsBalance: { increment: 15 } },
      });
      expect(prisma.referralPointsLedger.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          memberId: "member-1",
          points: 15,
          reason: "EVENT_TARGET_COMPLETED",
          relatedMemberId: undefined,
          relatedEventRegistrationId: "reg-1",
        },
      });
    });

    it("is not gated by OrgSettings.referralProgramEnabled", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ referralProgramEnabled: false }));
      prisma.member.update.mockResolvedValue(makeMember({ id: "member-1", referralPointsBalance: 15 }));

      await service.awardPointsForEventCompletion("org-1", "member-1", "reg-1", 15);

      expect(prisma.referralPointsLedger.create).toHaveBeenCalled();
    });
  });

  describe("ensureReferralCode", () => {
    it("returns the existing code without generating a new one", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ referralCode: "ABCD1234" }));

      const code = await service.ensureReferralCode("member-1");

      expect(code).toBe("ABCD1234");
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("generates and persists a new code when none exists", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ referralCode: null }));
      prisma.member.update.mockResolvedValue({});

      const code = await service.ensureReferralCode("member-1");

      expect(code).toHaveLength(8);
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "member-1" },
        data: { referralCode: code },
      });
    });

    it("retries on a unique-constraint collision and eventually gives up", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ referralCode: null }));
      const collision = Object.assign(new Error("unique constraint"), { code: "P2002", name: "PrismaClientKnownRequestError" });
      Object.setPrototypeOf(collision, (await import("@prisma/client")).Prisma.PrismaClientKnownRequestError.prototype);
      prisma.member.update.mockRejectedValue(collision);

      await expect(service.ensureReferralCode("member-1")).rejects.toThrow(ConflictException);
      expect(prisma.member.update).toHaveBeenCalledTimes(5);
    });
  });

  describe("getMySummary", () => {
    it("only exposes a referral code for ACTIVE members", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ status: "DRAFT", referralCode: null, referralPointsBalance: 0 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.member.findMany.mockResolvedValue([]);

      const summary = await service.getMySummary("member-1");

      expect(summary.referralCode).toBeNull();
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("computes rank and progress to the next rank from the points balance", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ status: "ACTIVE", referralCode: "ABCD1234", referralPointsBalance: 25 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.member.findMany.mockResolvedValue([]);

      const summary = await service.getMySummary("member-1");

      expect(summary.rank).toBe("GOLD");
      expect(summary.nextRank).toBe("PLATINUM");
      expect(summary.pointsToNextRank).toBe(25);
    });
  });

  describe("fulfillReward", () => {
    it("marks a PENDING reward as FULFILLED", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralReward.findFirst.mockResolvedValue({ id: "reward-1", status: "PENDING", note: null });
      prisma.referralReward.update.mockResolvedValue({
        id: "reward-1",
        memberId: "member-1",
        member: { fullName: "Test Member" },
        rank: "GOLD",
        pointsAtEarn: 20,
        status: "FULFILLED",
        fulfilledById: "staff-1",
        fulfilledAt: new Date(),
        note: "Gift handed over",
        createdAt: new Date(),
      });

      const result = await service.fulfillReward("reward-1", "org-1", "staff-1", "Gift handed over");

      expect(result.status).toBe("FULFILLED");
      expect(prisma.referralReward.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "reward-1" },
          data: expect.objectContaining({ status: "FULFILLED", fulfilledById: "staff-1" }),
        }),
      );
    });

    it("refuses to fulfill a reward twice", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralReward.findFirst.mockResolvedValue({ id: "reward-1", status: "FULFILLED", note: null });

      await expect(service.fulfillReward("reward-1", "org-1", "staff-1")).rejects.toThrow(ConflictException);
    });
  });
});
