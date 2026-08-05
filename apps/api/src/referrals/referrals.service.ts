import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ReferralLedgerEntryResponse,
  ReferralLeaderboardEntryResponse,
  ReferralNetworkNode,
  ReferralRank,
  ReferralRewardResponse,
  ReferralSummaryResponse,
  RewardStatus,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { generateReferralCode } from "./referral-code.util";
import { computeRank, type RankThresholds } from "./referral-rank.util";

const TIERS: ReferralRank[] = ["SILVER", "GOLD", "PLATINUM"];
const MAX_CODE_ATTEMPTS = 5;
const MAX_NETWORK_DEPTH = 5;

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  // Called from ApplicationsService.approve() right after a referred member
  // becomes ACTIVE — the single choke point for every approval, mirroring how
  // PaymentsService.finalizePayment() already fires NotificationService there.
  async awardPointsForApproval(approvedMemberId: string): Promise<void> {
    const approvedMember = await this.prisma.member.findUnique({ where: { id: approvedMemberId } });
    if (!approvedMember?.referralMemberId) {
      return;
    }

    const settings = await this.getSettings(approvedMember.organizationId);
    if (!settings.referralProgramEnabled) {
      return;
    }

    await this.prisma.$transaction((tx) =>
      this.creditPoints(
        tx,
        approvedMember.organizationId,
        approvedMember.referralMemberId!,
        settings.pointsPerApprovedReferral,
        "REFERRAL_APPROVED",
        { relatedMemberId: approvedMember.id },
        settings,
      ),
    );
  }

  // Called from EventsService when staff approve a member's submitted
  // evidence for an event's target — the analogous choke point to
  // awardPointsForApproval, just for the event path. Deliberately not gated
  // by OrgSettings.referralProgramEnabled (that toggle governs the
  // self-referral/link feature specifically; event-based points are a
  // separate earning channel into the same balance/rank/reward system).
  async awardPointsForEventCompletion(
    organizationId: string,
    memberId: string,
    eventRegistrationId: string,
    points: number,
  ): Promise<void> {
    if (points <= 0) {
      return;
    }
    const settings = await this.getSettings(organizationId);
    await this.prisma.$transaction((tx) =>
      this.creditPoints(
        tx,
        organizationId,
        memberId,
        points,
        "EVENT_TARGET_COMPLETED",
        { relatedEventRegistrationId: eventRegistrationId },
        settings,
      ),
    );
  }

  // Shared by both earning paths above: increments the cached balance,
  // appends a ledger row, and upserts a PENDING ReferralReward for any newly
  // crossed tier (idempotent via the @@unique([memberId, rank]) constraint).
  private async creditPoints(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    points: number,
    reason: "REFERRAL_APPROVED" | "EVENT_TARGET_COMPLETED",
    related: { relatedMemberId?: string; relatedEventRegistrationId?: string },
    thresholds: RankThresholds,
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

    for (const tier of TIERS) {
      if (member.referralPointsBalance >= tierMin(tier, thresholds)) {
        await tx.referralReward.upsert({
          where: { memberId_rank: { memberId, rank: tier } },
          update: {},
          create: {
            organizationId,
            memberId,
            rank: tier,
            pointsAtEarn: member.referralPointsBalance,
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
    const { rank, nextRank, pointsToNextRank } = computeRank(member.referralPointsBalance, settings);

    const referrals = await this.prisma.member.findMany({
      where: { referralMemberId: memberId },
      select: { id: true, fullName: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      referralCode,
      pointsBalance: member.referralPointsBalance,
      rank,
      nextRank,
      pointsToNextRank,
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
      rank: computeRank(member.referralPointsBalance, settings).rank,
      referralCount: member._count.referrals,
    }));
  }

  private async getSettings(organizationId: string): Promise<RankThresholds & { referralProgramEnabled: boolean; pointsPerApprovedReferral: number }> {
    return this.prisma.orgSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }
}

function tierMin(tier: ReferralRank, thresholds: RankThresholds): number {
  switch (tier) {
    case "SILVER":
      return thresholds.referralSilverMinPoints;
    case "GOLD":
      return thresholds.referralGoldMinPoints;
    case "PLATINUM":
      return thresholds.referralPlatinumMinPoints;
  }
}

function toRewardResponse(reward: {
  id: string;
  memberId: string;
  member: { fullName: string };
  rank: string;
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
    rank: reward.rank as ReferralRewardResponse["rank"],
    pointsAtEarn: reward.pointsAtEarn,
    status: reward.status as ReferralRewardResponse["status"],
    fulfilledById: reward.fulfilledById,
    fulfilledAt: reward.fulfilledAt,
    note: reward.note,
    createdAt: reward.createdAt,
  };
}
