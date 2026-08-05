import { z } from "zod";

export const referralRankSchema = z.enum(["SILVER", "GOLD", "PLATINUM"]);
export type ReferralRank = z.infer<typeof referralRankSchema>;

export const referralLedgerReasonSchema = z.enum([
  "REFERRAL_APPROVED",
  "EVENT_TARGET_COMPLETED",
  "MANUAL_ADJUSTMENT",
]);
export type ReferralLedgerReason = z.infer<typeof referralLedgerReasonSchema>;

export const rewardStatusSchema = z.enum(["PENDING", "FULFILLED"]);
export type RewardStatus = z.infer<typeof rewardStatusSchema>;

const referredMemberSummarySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  status: z.string(),
  createdAt: z.date(),
});

// Own referral dashboard — link/code, wallet balance, rank + progress to the
// next rank, and the direct (one-level) referrals list.
export const referralSummaryResponseSchema = z.object({
  referralCode: z.string().nullable(),
  pointsBalance: z.number(),
  rank: referralRankSchema.nullable(),
  nextRank: referralRankSchema.nullable(),
  pointsToNextRank: z.number().nullable(),
  referrals: z.array(referredMemberSummarySchema),
});
export type ReferralSummaryResponse = z.infer<typeof referralSummaryResponseSchema>;

export const referralLedgerEntryResponseSchema = z.object({
  id: z.string(),
  points: z.number(),
  reason: referralLedgerReasonSchema,
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
  rank: referralRankSchema,
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

export const referralLeaderboardEntryResponseSchema = z.object({
  memberId: z.string(),
  fullName: z.string(),
  pointsBalance: z.number(),
  rank: referralRankSchema.nullable(),
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
