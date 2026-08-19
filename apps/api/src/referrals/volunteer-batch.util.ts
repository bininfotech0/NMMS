import { PLAN_TIER_ORDER, type PlanTier, type VolunteerBatch } from "@nmms/shared";

export interface VolunteerBatchInfo {
  batch: VolunteerBatch | null;
  nextBatch: VolunteerBatch | null;
}

// Volunteer batch mirrors the member's current paid membership plan tier —
// previously computed from referralPointsBalance against org-configured
// thresholds, switched so a plan upgrade is what actually changes the badge.
// See ReferralsService.awardBatchRewardForTier for where rewards are granted
// (PaymentsService.upgradePlan / ApplicationsService.approve, the two places
// a member's planId is ever set).
export function computeVolunteerBatchFromTier(tier: PlanTier | null): VolunteerBatchInfo {
  if (!tier) {
    return { batch: null, nextBatch: PLAN_TIER_ORDER[0] };
  }
  const idx = PLAN_TIER_ORDER.indexOf(tier);
  const nextBatch = idx < PLAN_TIER_ORDER.length - 1 ? PLAN_TIER_ORDER[idx + 1] : null;
  return { batch: tier, nextBatch };
}

// Every tier at or below `tier`, lowest first — a member on the Gold plan has
// necessarily already qualified for the Silver reward too.
export function tiersUpTo(tier: PlanTier): PlanTier[] {
  return PLAN_TIER_ORDER.slice(0, PLAN_TIER_ORDER.indexOf(tier) + 1);
}
