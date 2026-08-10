import type { VolunteerBatch } from "@nmms/shared";

export interface VolunteerBatchThresholds {
  volunteerBatchSilverMinPoints: number;
  volunteerBatchGoldMinPoints: number;
  volunteerBatchPlatinumMinPoints: number;
}

export interface VolunteerBatchInfo {
  batch: VolunteerBatch | null;
  nextBatch: VolunteerBatch | null;
  pointsToNextBatch: number | null;
}

const TIER_ORDER: VolunteerBatch[] = ["SILVER", "GOLD", "PLATINUM"];

export function batchMinPoints(batch: VolunteerBatch, thresholds: VolunteerBatchThresholds): number {
  switch (batch) {
    case "SILVER":
      return thresholds.volunteerBatchSilverMinPoints;
    case "GOLD":
      return thresholds.volunteerBatchGoldMinPoints;
    case "PLATINUM":
      return thresholds.volunteerBatchPlatinumMinPoints;
  }
}

// Volunteer batch is always derived from the current points balance against
// the org's configured thresholds — never stored — so editing a threshold
// retroactively re-batches everyone.
export function computeVolunteerBatch(points: number, thresholds: VolunteerBatchThresholds): VolunteerBatchInfo {
  let batch: VolunteerBatch | null = null;
  let nextBatch: VolunteerBatch | null = null;
  let pointsToNextBatch: number | null = null;

  for (const tier of TIER_ORDER) {
    const min = batchMinPoints(tier, thresholds);
    if (points >= min) {
      batch = tier;
    } else if (nextBatch === null) {
      nextBatch = tier;
      pointsToNextBatch = min - points;
    }
  }

  return { batch, nextBatch, pointsToNextBatch };
}
