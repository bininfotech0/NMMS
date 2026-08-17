import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  PlanTier,
  ReferralLedgerEntryResponse,
  ReferralLeaderboardEntryResponse,
  ReferralNetworkNode,
  ReferralPointRuleResponse,
  ReferralRewardResponse,
  ReferralSummaryResponse,
  RewardStatus,
  VolunteerBatch,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PlanRewardsService } from "../plans/plan-rewards.service";
import { generateReferralCode } from "./referral-code.util";
import { batchMinPoints, computeVolunteerBatch, type VolunteerBatchThresholds } from "./volunteer-batch.util";

const TIERS: VolunteerBatch[] = ["SILVER", "GOLD", "PLATINUM"];
const MAX_CODE_ATTEMPTS = 5;
const MAX_NETWORK_DEPTH = 5;

interface ReferralSettings extends VolunteerBatchThresholds {
  referralProgramEnabled: boolean;
  pointsPerApprovedReferral: number;
  referralPointsCapPerMember: number | null;
  referralRequireActiveReferrerPlan: boolean;
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planRewards: PlanRewardsService,
  ) {}

  // Called from ApplicationsService.approve() right after a referred member
  // becomes ACTIVE — the single choke point for every approval, mirroring how
  // PaymentsService.finalizePayment() already fires NotificationService there.
  async awardPointsForApproval(approvedMemberId: string): Promise<void> {
    const approvedMember = await this.prisma.member.findUnique({
      where: { id: approvedMemberId },
      include: { plan: { select: { tier: true } } },
    });
    if (!approvedMember?.referralMemberId) {
      return;
    }

    const settings = await this.getSettings(approvedMember.organizationId);
    if (!settings.referralProgramEnabled) {
      return;
    }

    const referrer = await this.prisma.member.findUnique({
      where: { id: approvedMember.referralMemberId },
      include: { plan: { select: { tier: true, isActive: true } } },
    });
    if (!referrer) {
      return;
    }

    // A SUSPENDED/DECEASED/REJECTED referrer is not an eligible referrer — the
    // membership lifecycle treats these states as no longer (or never)
    // entitled to earn referral rewards. ACTIVE/EXPIRED members still earn:
    // an EXPIRED referrer remains entitled to points already due.
    if (referrer.status === "SUSPENDED" || referrer.status === "DECEASED" || referrer.status === "REJECTED") {
      return;
    }

    if (settings.referralRequireActiveReferrerPlan && referrer.plan?.isActive !== true) {
      return;
    }

    const points = await this.planRewards.computeReferralPoints(
      approvedMember.organizationId,
      (referrer.plan?.tier as PlanTier | null) ?? null,
      (approvedMember.plan?.tier as PlanTier | null) ?? null,
      settings.pointsPerApprovedReferral,
    );

    const cappedPoints = await this.applyReferralCap(referrer.id, points, settings.referralPointsCapPerMember);
    if (cappedPoints <= 0) {
      return;
    }

    await this.prisma.$transaction((tx) =>
      this.creditPoints(
        tx,
        approvedMember.organizationId,
        referrer.id,
        cappedPoints,
        "REFERRAL_APPROVED",
        { relatedMemberId: approvedMember.id },
        settings,
      ),
    );
  }

  // Clamps `points` so the referrer's lifetime REFERRAL_APPROVED total never
  // exceeds `cap` (null = uncapped). Returns 0 if the cap was already reached.
  private async applyReferralCap(referrerId: string, points: number, cap: number | null): Promise<number> {
    if (cap == null) {
      return points;
    }
    const { _sum } = await this.prisma.referralPointsLedger.aggregate({
      where: { memberId: referrerId, reason: "REFERRAL_APPROVED" },
      _sum: { points: true },
    });
    const alreadyEarned = _sum.points ?? 0;
    return Math.max(0, Math.min(points, cap - alreadyEarned));
  }

  // Called from EventsService.submitEvidence when a member (re)submits
  // evidence — locks in the points value at submission time (not recomputed
  // at review time, so a mid-review rule change never silently alters an
  // already-submitted amount). Does NOT touch Member.referralPointsBalance —
  // that stays the lifetime *approved* total until resolveEventEvidence
  // credits it, so WithdrawalsService's available-balance math is untouched
  // by points still awaiting review.
  async recordPendingEventPoints(
    organizationId: string,
    memberId: string,
    eventRegistrationId: string,
    points: number,
  ): Promise<void> {
    if (points <= 0) {
      return;
    }
    const existing = await this.prisma.referralPointsLedger.findFirst({
      where: { relatedEventRegistrationId: eventRegistrationId, reason: "EVENT_TARGET_COMPLETED", status: "PENDING" },
    });
    if (existing) {
      await this.prisma.referralPointsLedger.update({ where: { id: existing.id }, data: { points } });
    } else {
      await this.prisma.referralPointsLedger.create({
        data: {
          organizationId,
          memberId,
          points,
          reason: "EVENT_TARGET_COMPLETED",
          relatedEventRegistrationId: eventRegistrationId,
          status: "PENDING",
        },
      });
    }
  }

  // Called from EventsService.reviewEvidence for both the approve and reject
  // branches — the analogous choke point to awardPointsForApproval's credit,
  // just resolving a PENDING row created by recordPendingEventPoints instead
  // of crediting fresh. No-ops if there's no PENDING row (e.g. a 0-point
  // event never got one). Deliberately not gated by
  // OrgSettings.referralProgramEnabled (that toggle governs the
  // self-referral/link feature specifically; event-based points are a
  // separate earning channel into the same balance/batch/reward system).
  async resolveEventEvidence(
    organizationId: string,
    memberId: string,
    eventRegistrationId: string,
    approved: boolean,
  ): Promise<void> {
    const pending = await this.prisma.referralPointsLedger.findFirst({
      where: { relatedEventRegistrationId: eventRegistrationId, reason: "EVENT_TARGET_COMPLETED", status: "PENDING" },
    });
    if (!pending) {
      return;
    }
    if (!approved) {
      await this.prisma.referralPointsLedger.update({ where: { id: pending.id }, data: { status: "REJECTED" } });
      return;
    }

    const settings = await this.getSettings(organizationId);
    await this.prisma.$transaction(async (tx) => {
      const member = await tx.member.update({
        where: { id: memberId },
        data: { referralPointsBalance: { increment: pending.points } },
      });
      await tx.referralPointsLedger.update({ where: { id: pending.id }, data: { status: "APPROVED" } });
      await this.upsertBatchRewards(tx, organizationId, memberId, member.referralPointsBalance, settings);
    });
  }

  // Shared by the referral-approval path and resolveEventEvidence: appends a
  // ledger row (already-credited APPROVED for referrals; PENDING is handled
  // separately by recordPendingEventPoints), increments the cached balance,
  // and upserts a PENDING ReferralReward for any newly crossed volunteer
  // batch (idempotent via the @@unique([memberId, batch]) constraint).
  private async creditPoints(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    points: number,
    reason: "REFERRAL_APPROVED" | "EVENT_TARGET_COMPLETED",
    related: { relatedMemberId?: string; relatedEventRegistrationId?: string },
    thresholds: VolunteerBatchThresholds,
  ): Promise<void> {
    const member = await tx.member.update({
      where: { id: memberId },
      data: { referralPointsBalance: { increment: points } },
    });
    await tx.referralPointsLedger.create({
      data: {
        organizationId,
        memberId,
        points,
        reason,
        relatedMemberId: related.relatedMemberId,
        relatedEventRegistrationId: related.relatedEventRegistrationId,
      },
    });

    await this.upsertBatchRewards(tx, organizationId, memberId, member.referralPointsBalance, thresholds);
  }

  private async upsertBatchRewards(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    balance: number,
    thresholds: VolunteerBatchThresholds,
  ): Promise<void> {
    for (const tier of TIERS) {
      if (balance >= batchMinPoints(tier, thresholds)) {
        await tx.referralReward.upsert({
          where: { memberId_batch: { memberId, batch: tier } },
          update: {},
          create: {
            organizationId,
            memberId,
            batch: tier,
            pointsAtEarn: balance,
            status: "PENDING",
          },
        });
      }
    }
  }

  async ensureReferralCode(memberId: string): Promise<string> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    if (member.referralCode) {
      return member.referralCode;
    }
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateReferralCode();
      try {
        await this.prisma.member.update({ where: { id: memberId }, data: { referralCode: code } });
        return code;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
        // Code collision — retry with a fresh one.
      }
    }
    throw new ConflictException("Could not generate a unique referral code, please try again");
  }

  async getMySummary(memberId: string): Promise<ReferralSummaryResponse> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    // Only members whose own membership is ACTIVE can refer others — a
    // pending/draft self-registration sees no code until staff approve them.
    const referralCode = member.status === "ACTIVE" ? await this.ensureReferralCode(memberId) : null;

    const settings = await this.getSettings(member.organizationId);
    const { batch, nextBatch, pointsToNextBatch } = computeVolunteerBatch(member.referralPointsBalance, settings);

    const referrals = await this.prisma.member.findMany({
      where: { referralMemberId: memberId },
      select: { id: true, fullName: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      referralCode,
      pointsBalance: member.referralPointsBalance,
      batch,
      nextBatch,
      pointsToNextBatch,
      referrals,
    };
  }

  async getMyLedger(memberId: string): Promise<ReferralLedgerEntryResponse[]> {
    const entries = await this.prisma.referralPointsLedger.findMany({
      where: { memberId },
      include: {
        relatedMember: { select: { fullName: true } },
        relatedEventRegistration: { select: { event: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return entries.map((entry) => ({
      id: entry.id,
      points: entry.points,
      reason: entry.reason,
      status: entry.status as ReferralLedgerEntryResponse["status"],
      relatedMemberName: entry.relatedMember?.fullName ?? null,
      relatedEventTitle: entry.relatedEventRegistration?.event.title ?? null,
      note: entry.note,
      createdAt: entry.createdAt,
    }));
  }

  async getMyRewards(memberId: string): Promise<ReferralRewardResponse[]> {
    const rewards = await this.prisma.referralReward.findMany({
      where: { memberId },
      include: { member: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rewards.map(toRewardResponse);
  }

  // Staff-facing recursive downline view, depth-capped since there is no
  // closure table — fine for the small networks this program expects.
  // Staff-triggered equivalent of the lazy generation in getMySummary() —
  // for members who were registered/approved by staff and have never opened
  // their own portal (so ensureReferralCode was never called on their
  // behalf), letting staff hand them a working link right away.
  async ensureReferralCodeForAdmin(memberId: string, organizationId: string): Promise<string> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId },
      select: { id: true, status: true },
    });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    if (member.status !== "ACTIVE") {
      throw new ConflictException("Only ACTIVE members can have a referral code");
    }
    return this.ensureReferralCode(member.id);
  }

  async getNetwork(memberId: string, organizationId: string): Promise<ReferralNetworkNode> {
    const root = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId },
      select: { id: true, fullName: true, status: true, createdAt: true },
    });
    if (!root) {
      throw new NotFoundException("Member not found");
    }
    return this.buildNetworkNode(root, 0);
  }

  private async buildNetworkNode(
    node: { id: string; fullName: string; status: string; createdAt: Date },
    depth: number,
  ): Promise<ReferralNetworkNode> {
    const children =
      depth >= MAX_NETWORK_DEPTH
        ? []
        : await this.prisma.member.findMany({
            where: { referralMemberId: node.id },
            select: { id: true, fullName: true, status: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          });
    return {
      memberId: node.id,
      fullName: node.fullName,
      status: node.status,
      createdAt: node.createdAt,
      children: await Promise.all(children.map((child) => this.buildNetworkNode(child, depth + 1))),
    };
  }

  async listRewards(organizationId: string, status?: RewardStatus): Promise<ReferralRewardResponse[]> {
    const rewards = await this.prisma.referralReward.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: { member: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rewards.map(toRewardResponse);
  }

  async fulfillReward(
    rewardId: string,
    organizationId: string,
    fulfilledById: string,
    note?: string,
  ): Promise<ReferralRewardResponse> {
    const reward = await this.prisma.referralReward.findFirst({ where: { id: rewardId, organizationId } });
    if (!reward) {
      throw new NotFoundException("Reward not found");
    }
    if (reward.status === "FULFILLED") {
      throw new ConflictException("Reward has already been fulfilled");
    }
    const updated = await this.prisma.referralReward.update({
      where: { id: reward.id },
      data: { status: "FULFILLED", fulfilledById, fulfilledAt: new Date(), note: note ?? reward.note },
      include: { member: { select: { fullName: true } } },
    });
    return toRewardResponse(updated);
  }

  async leaderboard(organizationId: string, limit = 10): Promise<ReferralLeaderboardEntryResponse[]> {
    const members = await this.prisma.member.findMany({
      where: { organizationId, referralPointsBalance: { gt: 0 } },
      select: {
        id: true,
        fullName: true,
        referralPointsBalance: true,
        _count: { select: { referrals: true } },
      },
      orderBy: { referralPointsBalance: "desc" },
      take: limit,
    });
    const settings = await this.getSettings(organizationId);
    return members.map((member) => ({
      memberId: member.id,
      fullName: member.fullName,
      pointsBalance: member.referralPointsBalance,
      batch: computeVolunteerBatch(member.referralPointsBalance, settings).batch,
      referralCount: member._count.referrals,
    }));
  }

  async listReferralPointRules(organizationId: string): Promise<ReferralPointRuleResponse[]> {
    return this.planRewards.listReferralPointRules(organizationId);
  }

  async upsertReferralPointRuleMatrix(
    organizationId: string,
    rules: { referrerTier: PlanTier; referredTier: PlanTier; points: number }[],
  ): Promise<ReferralPointRuleResponse[]> {
    return this.planRewards.upsertReferralPointRuleMatrix(organizationId, rules);
  }

  private async getSettings(organizationId: string): Promise<ReferralSettings> {
    return this.prisma.orgSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }
}

function toRewardResponse(reward: {
  id: string;
  memberId: string;
  member: { fullName: string };
  batch: string;
  pointsAtEarn: number;
  status: string;
  fulfilledById: string | null;
  fulfilledAt: Date | null;
  note: string | null;
  createdAt: Date;
}): ReferralRewardResponse {
  return {
    id: reward.id,
    memberId: reward.memberId,
    memberName: reward.member.fullName,
    batch: reward.batch as ReferralRewardResponse["batch"],
    pointsAtEarn: reward.pointsAtEarn,
    status: reward.status as ReferralRewardResponse["status"],
    fulfilledById: reward.fulfilledById,
    fulfilledAt: reward.fulfilledAt,
    note: reward.note,
    createdAt: reward.createdAt,
  };
}
