import { z } from "zod";
import { planTierSchema } from "./plan";
import { MemberRole } from "../enums/member-role";

export const memberRegisterSchema = z.object({
  fullName: z.string().min(1),
  // Matches createMemberSchema.mobile (the staff-entry equivalent) — the
  // public form must not accept a looser mobile number than the staff one
  // does, since both create the same Member.mobile field.
  mobile: z.string().min(10).max(15),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits"),
  email: z.string().email().optional(),
  password: z.string().min(8),
  referralCode: z.string().min(1).optional(),
});
export type MemberRegisterInput = z.infer<typeof memberRegisterSchema>;

export const memberLoginSchema = z.object({
  mobile: z.string().min(6),
  password: z.string().min(8),
});
export type MemberLoginInput = z.infer<typeof memberLoginSchema>;

export const authMemberSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  mobile: z.string(),
  organizationId: z.string(),
  status: z.string(),
  role: z.nativeEnum(MemberRole),
  referralCode: z.string().nullable(),
  planName: z.string().nullable(),
  planTier: planTierSchema.nullable(),
});
export type AuthMember = z.infer<typeof authMemberSchema>;

export const memberTokensSchema = z.object({
  accessToken: z.string(),
});
export type MemberTokens = z.infer<typeof memberTokensSchema>;

// Public preview of who a ?ref=<code> link belongs to, shown before the
// registrant submits the signup form.
export const resolveReferralCodeResponseSchema = z.object({
  fullName: z.string(),
});
export type ResolveReferralCodeResponse = z.infer<typeof resolveReferralCodeResponseSchema>;
