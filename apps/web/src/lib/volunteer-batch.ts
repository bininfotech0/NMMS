import { PLAN_TIER_ORDER, type PlanTier, type VolunteerBatch } from "@nmms/shared";

// Mirrors apps/api/src/referrals/volunteer-batch.util.ts's
// computeVolunteerBatchFromTier — volunteer batch is just the member's
// current plan tier, kept in sync so it displays consistently whether it's
// read from their own portal or a staff admin screen.
export function computeVolunteerBatch(planTier: PlanTier | null): VolunteerBatch | null {
  return planTier;
}

// The next tier up from planTier, or null if already at the top — used to
// render "Upgrade to X to reach the next batch" from the same planTier the
// batch badge itself is computed from, so the two can never disagree.
export function computeNextVolunteerBatch(planTier: PlanTier | null): VolunteerBatch | null {
  if (!planTier) return PLAN_TIER_ORDER[0];
  const idx = PLAN_TIER_ORDER.indexOf(planTier);
  return idx < PLAN_TIER_ORDER.length - 1 ? PLAN_TIER_ORDER[idx + 1] : null;
}
