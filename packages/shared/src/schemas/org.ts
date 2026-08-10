import { z } from "zod";
import { withdrawalChargeTypeSchema } from "./withdrawal";

export const publicOrgSchema = z.object({
  name: z.string(),
  logoUrl: z.string().nullable(),
});
export type PublicOrg = z.infer<typeof publicOrgSchema>;

export const orgProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  address: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankIfscCode: z.string().nullable(),
  bankName: z.string().nullable(),
  membershipNumberFormat: z.string(),
  receiptNumberFormat: z.string(),
  referralProgramEnabled: z.boolean(),
  pointsPerApprovedReferral: z.number(),
  volunteerBatchSilverMinPoints: z.number(),
  volunteerBatchGoldMinPoints: z.number(),
  volunteerBatchPlatinumMinPoints: z.number(),
  referralPointsCapPerMember: z.number().nullable(),
  referralRequireActiveReferrerPlan: z.boolean(),
  pointsToMoneyRatioPoints: z.number(),
  pointsToMoneyRatioAmount: z.number(),
  kycRequireAadhaar: z.boolean(),
  kycRequirePan: z.boolean(),
  kycRequireBankOrUpi: z.boolean(),
  withdrawalMinAmount: z.number(),
  withdrawalMaxAmount: z.number().nullable(),
  withdrawalFrequencyDays: z.number().nullable(),
  withdrawalChargeType: withdrawalChargeTypeSchema,
  withdrawalChargeValue: z.number(),
});
export type OrgProfile = z.infer<typeof orgProfileSchema>;

export const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().nullish(),
  address: z.string().nullish(),
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
  bankAccountName: z.string().nullish(),
  bankAccountNumber: z.string().nullish(),
  bankIfscCode: z.string().nullish(),
  bankName: z.string().nullish(),
  membershipNumberFormat: z.string().min(1).optional(),
  receiptNumberFormat: z.string().min(1).optional(),
  referralProgramEnabled: z.boolean().optional(),
  pointsPerApprovedReferral: z.number().int().nonnegative().optional(),
  volunteerBatchSilverMinPoints: z.number().int().nonnegative().optional(),
  volunteerBatchGoldMinPoints: z.number().int().nonnegative().optional(),
  volunteerBatchPlatinumMinPoints: z.number().int().nonnegative().optional(),
  referralPointsCapPerMember: z.number().int().nonnegative().nullish(),
  referralRequireActiveReferrerPlan: z.boolean().optional(),
  pointsToMoneyRatioPoints: z.number().int().positive().optional(),
  pointsToMoneyRatioAmount: z.number().nonnegative().optional(),
  kycRequireAadhaar: z.boolean().optional(),
  kycRequirePan: z.boolean().optional(),
  kycRequireBankOrUpi: z.boolean().optional(),
  withdrawalMinAmount: z.number().nonnegative().optional(),
  withdrawalMaxAmount: z.number().nonnegative().nullish(),
  withdrawalFrequencyDays: z.number().int().nonnegative().nullish(),
  withdrawalChargeType: withdrawalChargeTypeSchema.optional(),
  withdrawalChargeValue: z.number().nonnegative().optional(),
});
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
