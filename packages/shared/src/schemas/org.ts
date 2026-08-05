import { z } from "zod";

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
  referralSilverMinPoints: z.number(),
  referralGoldMinPoints: z.number(),
  referralPlatinumMinPoints: z.number(),
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
  referralSilverMinPoints: z.number().int().nonnegative().optional(),
  referralGoldMinPoints: z.number().int().nonnegative().optional(),
  referralPlatinumMinPoints: z.number().int().nonnegative().optional(),
});
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
