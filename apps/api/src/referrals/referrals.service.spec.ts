import { ConflictException } from "@nestjs/common";
import { ReferralsService } from "./referrals.service";
import { makeMember, makeMockPrisma } from "../test/fixtures";

function makePlanRewards(overrides: Record<string, jest.Mock> = {}) {
  return {
    getMemberTier: jest.fn(),
    computeEventPoints: jest.fn(),
    computeReferralPoints: jest.fn().mockResolvedValue(10),
    listEventRewardRules: jest.fn(),
    upsertEventRewardRules: jest.fn(),
    listReferralPointRules: jest.fn(),
    upsertReferralPointRuleMatrix: jest.fn(),
    ...overrides,
  };
}

function makeService(
  prisma: ReturnType<typeof makeMockPrisma>,
  planRewards: ReturnType<typeof makePlanRewards> = makePlanRewards(),
) {
  return new ReferralsService(prisma as never, planRewards as never);
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    referralProgramEnabled: true,
    pointsPerApprovedReferral: 10,
    volunteerBatchSilverMinPoints: 0,
    volunteerBatchGoldMinPoints: 20,
    volunteerBatchPlatinumMinPoints: 50,
    referralPointsCapPerMember: null,
    // Off by default in these tests so the base crediting flow doesn't need a
    // referrer plan set up — see the dedicated eligibility tests below.
    referralRequireActiveReferrerPlan: false,
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
      const planRewards = makePlanRewards();
      const service = makeService(prisma, planRewards);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1" }));
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

    it("creates a PENDING reward the first time a volunteer batch threshold is crossed", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      // Referrer crosses from 10 -> 20 points, which is exactly the GOLD threshold.
      prisma.member.update.mockResolvedValue(
        makeMember({ id: "referrer-1", referralPointsBalance: 20 }),
      );

      await service.awardPointsForApproval("member-1");

      // SILVER (min 0) and GOLD (min 20) both qualify at 20 points; PLATINUM (min 50) does not.
      expect(prisma.referralReward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId_batch: { memberId: "referrer-1", batch: "SILVER" } },
        }),
      );
      expect(prisma.referralReward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId_batch: { memberId: "referrer-1", batch: "GOLD" } },
        }),
      );
      expect(prisma.referralReward.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId_batch: { memberId: "referrer-1", batch: "PLATINUM" } },
        }),
      );
    });

    it("resolves matrix points from PlanRewardsService using both members' plan tiers", async () => {
      const prisma = makeMockPrisma();
      const planRewards = makePlanRewards({ computeReferralPoints: jest.fn().mockResolvedValue(45) });
      const service = makeService(prisma, planRewards);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({
            id: "member-1",
            organizationId: "org-1",
            referralMemberId: "referrer-1",
            plan: { tier: "PLATINUM" },
          }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1", plan: { tier: "GOLD", isActive: true } }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.member.update.mockResolvedValue(makeMember({ id: "referrer-1", referralPointsBalance: 45 }));

      await service.awardPointsForApproval("member-1");

      expect(planRewards.computeReferralPoints).toHaveBeenCalledWith("org-1", "GOLD", "PLATINUM", 10);
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "referrer-1" },
        data: { referralPointsBalance: { increment: 45 } },
      });
    });

    it("skips crediting when referralRequireActiveReferrerPlan is true and the referrer's plan is inactive", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1", plan: { tier: "GOLD", isActive: false } }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ referralRequireActiveReferrerPlan: true }));

      await service.awardPointsForApproval("member-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("skips crediting when referralRequireActiveReferrerPlan is true and the referrer has no plan", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1", plan: null }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ referralRequireActiveReferrerPlan: true }));

      await service.awardPointsForApproval("member-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("skips crediting a SUSPENDED/DECEASED/REJECTED referrer entirely", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1", status: "SUSPENDED" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());

      await service.awardPointsForApproval("member-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("caps credited points at referralPointsCapPerMember, accounting for previously earned referral points", async () => {
      const prisma = makeMockPrisma();
      const planRewards = makePlanRewards({ computeReferralPoints: jest.fn().mockResolvedValue(10) });
      const service = makeService(prisma, planRewards);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ referralPointsCapPerMember: 15 }));
      prisma.referralPointsLedger.aggregate.mockResolvedValue({ _sum: { points: 8 } });
      prisma.member.update.mockResolvedValue(makeMember({ id: "referrer-1", referralPointsBalance: 15 }));

      await service.awardPointsForApproval("member-1");

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "referrer-1" },
        data: { referralPointsBalance: { increment: 7 } },
      });
    });

    it("does not credit any points once the referrer has already reached the cap", async () => {
      const prisma = makeMockPrisma();
      const planRewards = makePlanRewards({ computeReferralPoints: jest.fn().mockResolvedValue(10) });
      const service = makeService(prisma, planRewards);
      prisma.member.findUnique
        .mockResolvedValueOnce(
          makeMember({ id: "member-1", organizationId: "org-1", referralMemberId: "referrer-1" }),
        )
        .mockResolvedValueOnce(makeMember({ id: "referrer-1" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ referralPointsCapPerMember: 15 }));
      prisma.referralPointsLedger.aggregate.mockResolvedValue({ _sum: { points: 15 } });

      await service.awardPointsForApproval("member-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("recordPendingEventPoints", () => {
    it("does nothing when points is zero or negative", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);

      await service.recordPendingEventPoints("org-1", "member-1", "reg-1", 0);

      expect(prisma.referralPointsLedger.findFirst).not.toHaveBeenCalled();
      expect(prisma.referralPointsLedger.create).not.toHaveBeenCalled();
    });

    it("creates a PENDING ledger row without touching the cached balance", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralPointsLedger.findFirst.mockResolvedValue(null);

      await service.recordPendingEventPoints("org-1", "member-1", "reg-1", 15);

      expect(prisma.referralPointsLedger.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          memberId: "member-1",
          points: 15,
          reason: "EVENT_TARGET_COMPLETED",
          relatedEventRegistrationId: "reg-1",
          status: "PENDING",
        },
      });
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("updates an existing PENDING row instead of creating a duplicate on resubmission", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralPointsLedger.findFirst.mockResolvedValue({ id: "ledger-1", points: 10 });

      await service.recordPendingEventPoints("org-1", "member-1", "reg-1", 20);

      expect(prisma.referralPointsLedger.update).toHaveBeenCalledWith({
        where: { id: "ledger-1" },
        data: { points: 20 },
      });
      expect(prisma.referralPointsLedger.create).not.toHaveBeenCalled();
    });
  });

  describe("resolveEventEvidence", () => {
    it("does nothing when there is no PENDING row for the registration", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralPointsLedger.findFirst.mockResolvedValue(null);

      await service.resolveEventEvidence("org-1", "member-1", "reg-1", true);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("on rejection, flips the row to REJECTED without touching the balance", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralPointsLedger.findFirst.mockResolvedValue({ id: "ledger-1", points: 15 });

      await service.resolveEventEvidence("org-1", "member-1", "reg-1", false);

      expect(prisma.referralPointsLedger.update).toHaveBeenCalledWith({
        where: { id: "ledger-1" },
        data: { status: "REJECTED" },
      });
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("on approval, credits the locked-in points and flips the row to APPROVED", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralPointsLedger.findFirst.mockResolvedValue({ id: "ledger-1", points: 15 });
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.member.update.mockResolvedValue(makeMember({ id: "member-1", referralPointsBalance: 15 }));

      await service.resolveEventEvidence("org-1", "member-1", "reg-1", true);

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "member-1" },
        data: { referralPointsBalance: { increment: 15 } },
      });
      expect(prisma.referralPointsLedger.update).toHaveBeenCalledWith({
        where: { id: "ledger-1" },
        data: { status: "APPROVED" },
      });
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

    it("computes the volunteer batch and progress to the next batch from the points balance", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(
        makeMember({ status: "ACTIVE", referralCode: "ABCD1234", referralPointsBalance: 25 }),
      );
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings());
      prisma.member.findMany.mockResolvedValue([]);

      const summary = await service.getMySummary("member-1");

      expect(summary.batch).toBe("GOLD");
      expect(summary.nextBatch).toBe("PLATINUM");
      expect(summary.pointsToNextBatch).toBe(25);
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
        batch: "GOLD",
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
