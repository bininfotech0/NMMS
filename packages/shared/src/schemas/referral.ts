import { z } from "zod";
import { planTierSchema } from "./plan";

// Points-threshold badge tier, computed from a member's referral points
// balance against admin-configured thresholds. Unrelated to PlanTier (the
// membership plan a member paid for) despite sharing the same three names —
// see VolunteerBatchBadge / computeVolunteerBatch on the frontend.
export const volunteerBatchSchema = z.enum(["SILVER", "GOLD", "PLATINUM"]);
export type VolunteerBatch = z.infer<typeof volunteerBatchSchema>;

export const referralLedgerReasonSchema = z.enum([
  "REFERRAL_APPROVED",
  "EVENT_TARGET_COMPLETED",
  "MANUAL_ADJUSTMENT",
  "WITHDRAWAL_CONVERTED",
]);
export type ReferralLedgerReason = z.infer<typeof referralLedgerReasonSchema>;

export const rewardStatusSchema = z.enum(["PENDING", "FULFILLED"]);
export type RewardStatus = z.infer<typeof rewardStatusSchema>;

// A ledger row's own lifecycle — distinct from RewardStatus above. Only
// EVENT_TARGET_COMPLETED rows are ever PENDING/REJECTED (evidence awaiting
// review); REFERRAL_APPROVED rows insert straight to APPROVED. CONVERTED is
// reserved for a future points-to-money conversion lifecycle.
export const pointsLedgerStatusSchema = z.enum(["PENDING", "APPROVED", "CONVERTED", "REJECTED"]);
export type PointsLedgerStatus = z.infer<typeof pointsLedgerStatusSchema>;

const referredMemberSummarySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  status: z.string(),
  createdAt: z.date(),
});

// Own referral dashboard — link/code, wallet balance, volunteer batch +
// progress to the next batch, and the direct (one-level) referrals list.
export const referralSummaryResponseSchema = z.object({
  referralCode: z.string().nullable(),
  pointsBalance: z.number(),
  batch: volunteerBatchSchema.nullable(),
  nextBatch: volunteerBatchSchema.nullable(),
  pointsToNextBatch: z.number().nullable(),
  referrals: z.array(referredMemberSummarySchema),
});
export type ReferralSummaryResponse = z.infer<typeof referralSummaryResponseSchema>;

export const referralLedgerEntryResponseSchema = z.object({
  id: z.string(),
  points: z.number(),
  reason: referralLedgerReasonSchema,
  status: pointsLedgerStatusSchema,
  relatedMemberName: z.string().nullable(),
  relatedEventTitle: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.date(),
});
export type ReferralLedgerEntryResponse = z.infer<typeof referralLedgerEntryResponseSchema>;

export const referralRewardResponseSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  batch: volunteerBatchSchema,
  pointsAtEarn: z.number(),
  status: rewardStatusSchema,
  fulfilledById: z.string().nullable(),
  fulfilledAt: z.date().nullable(),
  note: z.string().nullable(),
  createdAt: z.date(),
});
export type ReferralRewardResponse = z.infer<typeof referralRewardResponseSchema>;

export const fulfillRewardSchema = z.object({
  note: z.string().optional(),
});
export type FulfillRewardInput = z.infer<typeof fulfillRewardSchema>;

// Staff-triggered generation for members who haven't opened their own
// portal yet (e.g. field-registered, no self-service login) — see
// ReferralsService.ensureReferralCodeForAdmin.
export const generateReferralCodeResponseSchema = z.object({
  referralCode: z.string(),
});
export type GenerateReferralCodeResponse = z.infer<typeof generateReferralCodeResponseSchema>;

export const referralLeaderboardEntryResponseSchema = z.object({
  memberId: z.string(),
  fullName: z.string(),
  pointsBalance: z.number(),
  batch: volunteerBatchSchema.nullable(),
  referralCount: z.number(),
});
export type ReferralLeaderboardEntryResponse = z.infer<typeof referralLeaderboardEntryResponseSchema>;

// One node in the staff-facing downline tree — recursive via `children`,
// depth-capped server-side since there is no closure table.
export interface ReferralNetworkNode {
  memberId: string;
  fullName: string;
  status: string;
  createdAt: Date;
  children: ReferralNetworkNode[];
}
export const referralNetworkNodeSchema: z.ZodType<ReferralNetworkNode> = z.lazy(() =>
  z.object({
    memberId: z.string(),
    fullName: z.string(),
    status: z.string(),
    createdAt: z.date(),
    children: z.array(referralNetworkNodeSchema),
  }),
);

// Used by the "Referred by" typeahead in the staff registration wizard.
export const referrerSearchResultSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  referralCode: z.string().nullable(),
  membershipNumber: z.string().nullable(),
});
export type ReferrerSearchResult = z.infer<typeof referrerSearchResultSchema>;

// Referrer-tier x referred-tier referral point matrix — up to 9 rows. A
// missing cell (or either side's plan tier being null) falls back to
// OrgSettings.pointsPerApprovedReferral.
export const referralPointRuleSchema = z.object({
  referrerTier: planTierSchema,
  referredTier: planTierSchema,
  points: z.number().int().nonnegative(),
});
export type ReferralPointRule = z.infer<typeof referralPointRuleSchema>;

export const referralPointRuleResponseSchema = referralPointRuleSchema.extend({
  id: z.string(),
});
export type ReferralPointRuleResponse = z.infer<typeof referralPointRuleResponseSchema>;

export const upsertReferralPointRuleMatrixSchema = z.object({
  rules: z.array(referralPointRuleSchema).max(9),
});
export type UpsertReferralPointRuleMatrixInput = z.infer<typeof upsertReferralPointRuleMatrixSchema>;
