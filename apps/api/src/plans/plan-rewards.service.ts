import { Injectable } from "@nestjs/common";
import type { PlanTier } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface EventRewardRuleResponse {
  id: string;
  tier: PlanTier;
  points: number;
}

export interface ReferralPointRuleResponse {
  id: string;
  referrerTier: PlanTier;
  referredTier: PlanTier;
  points: number;
}

// Resolves plan-tier-aware points for the two existing earning paths (event
// evidence approval, referral approval) and owns admin CRUD for the rule
// tables that drive them — see ReferralsService.awardPointsForApproval and
// EventsService.reviewEvidence.
@Injectable()
export class PlanRewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberTier(memberId: string): Promise<PlanTier | null> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { plan: { select: { tier: true } } },
    });
    return (member?.plan?.tier as PlanTier | null) ?? null;
  }

  // Falls back to the event's base pointsReward when the tier is null or no
  // rule row matches.
  async computeEventPoints(organizationId: string, eventId: string, tier: PlanTier | null): Promise<number> {
    if (tier) {
      const rule = await this.prisma.eventRewardRule.findUnique({
        where: { eventId_tier: { eventId, tier } },
        select: { points: true },
      });
      if (rule) {
        return rule.points;
      }
    }
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { pointsReward: true },
    });
    return event?.pointsReward ?? 0;
  }

  // Falls back to the passed-in fallback (OrgSettings.pointsPerApprovedReferral)
  // when either tier is null or no matrix cell matches.
  async computeReferralPoints(
    organizationId: string,
    referrerTier: PlanTier | null,
    referredTier: PlanTier | null,
    fallbackPoints: number,
  ): Promise<number> {
    if (!referrerTier || !referredTier) {
      return fallbackPoints;
    }
    const rule = await this.prisma.referralPointRule.findUnique({
      where: { organizationId_referrerTier_referredTier: { organizationId, referrerTier, referredTier } },
      select: { points: true },
    });
    return rule?.points ?? fallbackPoints;
  }

  async listEventRewardRules(organizationId: string, eventId: string): Promise<EventRewardRuleResponse[]> {
    const rules = await this.prisma.eventRewardRule.findMany({
      where: { organizationId, eventId },
    });
    return rules.map((r) => ({ id: r.id, tier: r.tier as PlanTier, points: r.points }));
  }

  // tiers omitted from `rules` have their existing row (if any) deleted.
  async upsertEventRewardRules(
    organizationId: string,
    eventId: string,
    rules: { tier: PlanTier; points: number }[],
  ): Promise<EventRewardRuleResponse[]> {
    const tiers: PlanTier[] = ["SILVER", "GOLD", "PLATINUM"];
    const included = new Map(rules.map((r) => [r.tier, r.points]));

    await this.prisma.$transaction(
      tiers.map((tier) => {
        const points = included.get(tier);
        if (points === undefined) {
          return this.prisma.eventRewardRule.deleteMany({ where: { eventId, tier } });
        }
        return this.prisma.eventRewardRule.upsert({
          where: { eventId_tier: { eventId, tier } },
          create: { organizationId, eventId, tier, points },
          update: { points },
        });
      }),
    );

    return this.listEventRewardRules(organizationId, eventId);
  }

  async listReferralPointRules(organizationId: string): Promise<ReferralPointRuleResponse[]> {
    const rules = await this.prisma.referralPointRule.findMany({ where: { organizationId } });
    return rules.map((r) => ({
      id: r.id,
      referrerTier: r.referrerTier as PlanTier,
      referredTier: r.referredTier as PlanTier,
      points: r.points,
    }));
  }

  // Full-replace semantics for the cells provided — cells not included are
  // left untouched (the admin UI always sends all 9 cells).
  async upsertReferralPointRuleMatrix(
    organizationId: string,
    rules: { referrerTier: PlanTier; referredTier: PlanTier; points: number }[],
  ): Promise<ReferralPointRuleResponse[]> {
    await this.prisma.$transaction(
      rules.map((rule) =>
        this.prisma.referralPointRule.upsert({
          where: {
            organizationId_referrerTier_referredTier: {
              organizationId,
              referrerTier: rule.referrerTier,
              referredTier: rule.referredTier,
            },
          },
          create: { organizationId, ...rule },
          update: { points: rule.points },
        }),
      ),
    );

    return this.listReferralPointRules(organizationId);
  }
}
