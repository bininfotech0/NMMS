import type { ReferralRank } from "@nmms/shared";

export interface RankThresholds {
  referralSilverMinPoints: number;
  referralGoldMinPoints: number;
  referralPlatinumMinPoints: number;
}

const TIER_ORDER: ReferralRank[] = ["SILVER", "GOLD", "PLATINUM"];

function tierMinPoints(rank: ReferralRank, thresholds: RankThresholds): number {
  switch (rank) {
    case "SILVER":
      return thresholds.referralSilverMinPoints;
    case "GOLD":
      return thresholds.referralGoldMinPoints;
    case "PLATINUM":
      return thresholds.referralPlatinumMinPoints;
  }
}

// Mirrors apps/api/src/referrals/referral-rank.util.ts's computeRank — kept
// in sync so a member's rank (aka "Volunteer Batch") displays consistently
// whether it's read from their own portal or a staff admin screen.
export function computeRank(points: number, thresholds: RankThresholds): ReferralRank | null {
  let rank: ReferralRank | null = null;
  for (const tier of TIER_ORDER) {
    if (points >= tierMinPoints(tier, thresholds)) {
      rank = tier;
    }
  }
  return rank;
}
