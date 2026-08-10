import type { VolunteerBatch } from "@nmms/shared";

export interface VolunteerBatchThresholds {
  volunteerBatchSilverMinPoints: number;
  volunteerBatchGoldMinPoints: number;
  volunteerBatchPlatinumMinPoints: number;
}

const TIER_ORDER: VolunteerBatch[] = ["SILVER", "GOLD", "PLATINUM"];

function batchMinPoints(batch: VolunteerBatch, thresholds: VolunteerBatchThresholds): number {
  switch (batch) {
    case "SILVER":
      return thresholds.volunteerBatchSilverMinPoints;
    case "GOLD":
      return thresholds.volunteerBatchGoldMinPoints;
    case "PLATINUM":
      return thresholds.volunteerBatchPlatinumMinPoints;
  }
}

// Mirrors apps/api/src/referrals/volunteer-batch.util.ts's
// computeVolunteerBatch — kept in sync so a member's volunteer batch displays
// consistently whether it's read from their own portal or a staff admin screen.
export function computeVolunteerBatch(points: number, thresholds: VolunteerBatchThresholds): VolunteerBatch | null {
  let batch: VolunteerBatch | null = null;
  for (const tier of TIER_ORDER) {
    if (points >= batchMinPoints(tier, thresholds)) {
      batch = tier;
    }
  }
  return batch;
}
