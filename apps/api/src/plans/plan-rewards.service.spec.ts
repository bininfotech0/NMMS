import { PlanRewardsService } from "./plan-rewards.service";
import { makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  return new PlanRewardsService(prisma as never);
}

describe("PlanRewardsService", () => {
  describe("computeEventPoints", () => {
    it("returns the rule's points when a matching (eventId, tier) row exists", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.eventRewardRule.findUnique.mockResolvedValue({ points: 40 });

      const points = await service.computeEventPoints("org-1", "event-1", "PLATINUM");

      expect(points).toBe(40);
      expect(prisma.eventRewardRule.findUnique).toHaveBeenCalledWith({
        where: { eventId_tier: { eventId: "event-1", tier: "PLATINUM" } },
        select: { points: true },
      });
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
    });

    it("falls back to the event's base pointsReward when the tier is null", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.event.findUnique.mockResolvedValue({ pointsReward: 20 });

      const points = await service.computeEventPoints("org-1", "event-1", null);

      expect(points).toBe(20);
      expect(prisma.eventRewardRule.findUnique).not.toHaveBeenCalled();
    });

    it("falls back to the event's base pointsReward when no rule matches the tier", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.eventRewardRule.findUnique.mockResolvedValue(null);
      prisma.event.findUnique.mockResolvedValue({ pointsReward: 20 });

      const points = await service.computeEventPoints("org-1", "event-1", "SILVER");

      expect(points).toBe(20);
    });
  });

  describe("computeReferralPoints", () => {
    it("returns the matrix cell's points when both tiers are present and a row exists", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralPointRule.findUnique.mockResolvedValue({ points: 45 });

      const points = await service.computeReferralPoints("org-1", "GOLD", "PLATINUM", 10);

      expect(points).toBe(45);
      expect(prisma.referralPointRule.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_referrerTier_referredTier: {
            organizationId: "org-1",
            referrerTier: "GOLD",
            referredTier: "PLATINUM",
          },
        },
        select: { points: true },
      });
    });

    it("falls back to the passed-in fallback when either tier is null", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);

      const points = await service.computeReferralPoints("org-1", null, "PLATINUM", 10);

      expect(points).toBe(10);
      expect(prisma.referralPointRule.findUnique).not.toHaveBeenCalled();
    });

    it("falls back to the passed-in fallback when no matrix cell matches", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.referralPointRule.findUnique.mockResolvedValue(null);

      const points = await service.computeReferralPoints("org-1", "SILVER", "SILVER", 10);

      expect(points).toBe(10);
    });
  });

  describe("upsertEventRewardRules", () => {
    it("upserts provided tiers and deletes omitted ones", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
      prisma.eventRewardRule.findMany.mockResolvedValue([
        { id: "r1", tier: "GOLD", points: 30 },
      ]);

      await service.upsertEventRewardRules("org-1", "event-1", [{ tier: "GOLD", points: 30 }]);

      expect(prisma.eventRewardRule.upsert).toHaveBeenCalledWith({
        where: { eventId_tier: { eventId: "event-1", tier: "GOLD" } },
        create: { organizationId: "org-1", eventId: "event-1", tier: "GOLD", points: 30 },
        update: { points: 30 },
      });
      expect(prisma.eventRewardRule.deleteMany).toHaveBeenCalledWith({
        where: { eventId: "event-1", tier: "SILVER" },
      });
      expect(prisma.eventRewardRule.deleteMany).toHaveBeenCalledWith({
        where: { eventId: "event-1", tier: "PLATINUM" },
      });
    });
  });

  describe("upsertReferralPointRuleMatrix", () => {
    it("upserts each provided cell without touching cells not included", async () => {
      const prisma = makeMockPrisma();
      const service = makeService(prisma);
      prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
      prisma.referralPointRule.findMany.mockResolvedValue([]);

      await service.upsertReferralPointRuleMatrix("org-1", [
        { referrerTier: "SILVER", referredTier: "SILVER", points: 10 },
      ]);

      expect(prisma.referralPointRule.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.referralPointRule.upsert).toHaveBeenCalledWith({
        where: {
          organizationId_referrerTier_referredTier: {
            organizationId: "org-1",
            referrerTier: "SILVER",
            referredTier: "SILVER",
          },
        },
        create: { organizationId: "org-1", referrerTier: "SILVER", referredTier: "SILVER", points: 10 },
        update: { points: 10 },
      });
    });
  });
});
