import type { ReferralRank } from "@nmms/shared";

export interface RankThresholds {
  referralSilverMinPoints: number;
  referralGoldMinPoints: number;
  referralPlatinumMinPoints: number;
}

export interface RankInfo {
  rank: ReferralRank | null;
  nextRank: ReferralRank | null;
  pointsToNextRank: number | null;
}

const TIER_ORDER: ReferralRank[] = ["SILVER", "GOLD", "PLATINUM"];

export function tierMinPoints(rank: ReferralRank, thresholds: RankThresholds): number {
  switch (rank) {
    case "SILVER":
      return thresholds.referralSilverMinPoints;
    case "GOLD":
      return thresholds.referralGoldMinPoints;
    case "PLATINUM":
      return thresholds.referralPlatinumMinPoints;
  }
}

// Rank is always derived from the current points balance against the org's
// configured thresholds — never stored — so editing a threshold retroactively
// re-ranks everyone.
export function computeRank(points: number, thresholds: RankThresholds): RankInfo {
  let rank: ReferralRank | null = null;
  let nextRank: ReferralRank | null = null;
  let pointsToNextRank: number | null = null;

  for (const tier of TIER_ORDER) {
    const min = tierMinPoints(tier, thresholds);
    if (points >= min) {
      rank = tier;
    } else if (nextRank === null) {
      nextRank = tier;
      pointsToNextRank = min - points;
    }
  }

  return { rank, nextRank, pointsToNextRank };
}
