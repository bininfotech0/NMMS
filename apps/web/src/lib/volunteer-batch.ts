import type { PlanTier, VolunteerBatch } from "@nmms/shared";

// Mirrors apps/api/src/referrals/volunteer-batch.util.ts's
// computeVolunteerBatchFromTier — volunteer batch is just the member's
// current plan tier, kept in sync so it displays consistently whether it's
// read from their own portal or a staff admin screen.
export function computeVolunteerBatch(planTier: PlanTier | null): VolunteerBatch | null {
  return planTier;
}
