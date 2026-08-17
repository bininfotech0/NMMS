import { z } from "zod";
import { planTierSchema } from "./plan";
import { kycStatusSchema } from "./kyc";

export const memberStatusSchema = z.enum([
  "DRAFT",
  "PAYMENT_COLLECTED",
  "SUBMITTED",
  // Legacy: retired from the active (one-level approval) flow, kept for old rows.
  "VERIFIED",
  "APPROVED",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED",
  "RENEWED",
  "DECEASED",
]);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const registrationModeSchema = z.enum(["ONLINE", "OFFLINE"]);
export type RegistrationMode = z.infer<typeof registrationModeSchema>;

export const identityEntryMethodSchema = z.enum(["AUTO_FILL", "MANUAL"]);
export type IdentityEntryMethod = z.infer<typeof identityEntryMethodSchema>;

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);
export type Gender = z.infer<typeof genderSchema>;

export const maritalStatusSchema = z.enum(["SINGLE", "MARRIED", "WIDOWED", "DIVORCED"]);
export type MaritalStatus = z.infer<typeof maritalStatusSchema>;

export const paymentFrequencySchema = z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"]);
export type PaymentFrequency = z.infer<typeof paymentFrequencySchema>;

export const nomineeSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().nullish(),
  dob: z.coerce.date().nullish(),
  address: z.string().nullish(),
  mobile: z.string().nullish(),
});
export type NomineeInput = z.infer<typeof nomineeSchema>;

export const nomineeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string().nullable(),
  dob: z.date().nullable(),
  address: z.string().nullable(),
  mobile: z.string().nullable(),
});
export type NomineeResponse = z.infer<typeof nomineeResponseSchema>;

// Minimum viable fields to start a registration; everything else is filled in
// incrementally via PATCH as the wizard's steps are completed (Save as Draft).
export const createMemberSchema = z.object({
  fullName: z.string().min(1),
  mobile: z.string().min(10).max(15),

  // Field-executive registration metadata, captured client-side at draft
  // creation (see apps/web/src/lib/device.ts) — all optional since manual/
  // desktop registration has no device/GPS to report.
  registrationLatitude: z.number().min(-90).max(90).nullish(),
  registrationLongitude: z.number().min(-180).max(180).nullish(),
  deviceId: z.string().nullish(),
  registrationMode: registrationModeSchema.nullish(),
  registeredAt: z.coerce.date().nullish(),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  fullName: z.string().min(1).optional(),
  title: z.string().nullish(),
  firstName: z.string().nullish(),
  middleName: z.string().nullish(),
  lastName: z.string().nullish(),
  dob: z.coerce.date().nullish(),
  gender: genderSchema.nullish(),
  maritalStatus: maritalStatusSchema.nullish(),
  bloodGroup: z.string().nullish(),
  nationality: z.string().nullish(),
  fatherName: z.string().nullish(),
  motherName: z.string().nullish(),

  spouseOrGuardianName: z.string().nullish(),
  monthlyIncome: z.number().nonnegative().nullish(),
  familyMembersCount: z.number().int().nonnegative().nullish(),
  familyTypeId: z.string().nullish(),
  childrenCount: z.number().int().nonnegative().nullish(),
  isDifferentlyAbled: z.boolean().optional(),
  isExServiceman: z.boolean().optional(),
  isSeniorCitizen: z.boolean().optional(),

  mobile: z.string().min(10).max(15).optional(),
  whatsappNumber: z.string().nullish(),
  email: z.string().email().nullish(),
  emergencyContactName: z.string().nullish(),
  emergencyContactMobile: z.string().nullish(),
  emergencyContactRelationship: z.string().nullish(),

  // Current address
  pincode: z.string().nullish(),
  addressLine: z.string().nullish(),
  landmark: z.string().nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),

  // Permanent address — the frontend copies current → perm* on save when
  // sameAsCurrentAddress is checked; the backend stores both explicitly.
  sameAsCurrentAddress: z.boolean().optional(),
  permPincode: z.string().nullish(),
  permAddressLine: z.string().nullish(),
  permLandmark: z.string().nullish(),

  // 12-digit raw Aadhaar, write-only — the server hashes it and stores only
  // the hash + last 4 digits; the raw number is never persisted or returned.
  aadhaarNumber: z.string().regex(/^\d{12}$/).nullish(),
  pan: z.string().nullish(),
  voterId: z.string().nullish(),
  passportNumber: z.string().nullish(),
  drivingLicenceNumber: z.string().nullish(),
  identityEntryMethod: identityEntryMethodSchema.nullish(),

  educationId: z.string().nullish(),
  occupationId: z.string().nullish(),
  qualificationDetail: z.string().nullish(),

  languagesKnown: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),

  religionId: z.string().nullish(),
  casteCategoryId: z.string().nullish(),
  businessTypeId: z.string().nullish(),
  membershipCategoryId: z.string().nullish(),
  branchId: z.string().nullish(),
  referralMemberId: z.string().nullish(),

  socialMediaLinks: z.string().nullish(),

  declarationInfoCorrect: z.boolean().optional(),
  declarationAcceptConstitution: z.boolean().optional(),
  declarationAcceptPrivacyPolicy: z.boolean().optional(),
  declarationAcceptTerms: z.boolean().optional(),
  declarationPlace: z.string().nullish(),
  declarationDate: z.coerce.date().nullish(),

  nominee: nomineeSchema.nullish(),

  planId: z.string().nullish(),
  feeOverride: z.number().nonnegative().nullish(),
  paymentFrequency: paymentFrequencySchema.nullish(),
  unit: z.string().nullish(),
  membershipRemarks: z.string().nullish(),
  joiningDate: z.coerce.date().nullish(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// Curated subset of updateMemberSchema a member may change about themselves
// via the member portal's self-service profile page. Deliberately excludes:
// mobile (login identifier, no DB uniqueness enforcement — stays staff-only
// like Aadhaar/PAN), identity documents, plan/fee/payment fields, referral,
// branch/membership category, declarations, and nominee.
export const memberSelfUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  title: z.string().nullish(),
  firstName: z.string().nullish(),
  middleName: z.string().nullish(),
  lastName: z.string().nullish(),
  dob: z.coerce.date().nullish(),
  gender: genderSchema.nullish(),
  maritalStatus: maritalStatusSchema.nullish(),
  bloodGroup: z.string().nullish(),
  nationality: z.string().nullish(),
  fatherName: z.string().nullish(),
  motherName: z.string().nullish(),

  spouseOrGuardianName: z.string().nullish(),
  monthlyIncome: z.number().nonnegative().nullish(),
  familyMembersCount: z.number().int().nonnegative().nullish(),
  familyTypeId: z.string().nullish(),
  childrenCount: z.number().int().nonnegative().nullish(),
  isDifferentlyAbled: z.boolean().optional(),
  isExServiceman: z.boolean().optional(),
  isSeniorCitizen: z.boolean().optional(),

  whatsappNumber: z.string().nullish(),
  email: z.string().email().nullish(),
  emergencyContactName: z.string().nullish(),
  emergencyContactMobile: z.string().nullish(),
  emergencyContactRelationship: z.string().nullish(),

  pincode: z.string().nullish(),
  addressLine: z.string().nullish(),
  landmark: z.string().nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),

  sameAsCurrentAddress: z.boolean().optional(),
  permPincode: z.string().nullish(),
  permAddressLine: z.string().nullish(),
  permLandmark: z.string().nullish(),

  educationId: z.string().nullish(),
  occupationId: z.string().nullish(),
  qualificationDetail: z.string().nullish(),

  languagesKnown: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),

  religionId: z.string().nullish(),
  casteCategoryId: z.string().nullish(),
  businessTypeId: z.string().nullish(),

  socialMediaLinks: z.string().nullish(),
});
export type MemberSelfUpdateInput = z.infer<typeof memberSelfUpdateSchema>;

export const memberResponseSchema = z.object({
  id: z.string(),
  membershipNumber: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  registrationLatitude: z.number().nullable(),
  registrationLongitude: z.number().nullable(),
  deviceId: z.string().nullable(),
  registrationMode: registrationModeSchema.nullable(),
  registeredAt: z.date().nullable(),
  identityEntryMethod: identityEntryMethodSchema.nullable(),
  fullName: z.string(),
  title: z.string().nullable(),
  firstName: z.string().nullable(),
  middleName: z.string().nullable(),
  lastName: z.string().nullable(),
  dob: z.date().nullable(),
  gender: genderSchema.nullable(),
  maritalStatus: maritalStatusSchema.nullable(),
  bloodGroup: z.string().nullable(),
  nationality: z.string().nullable(),
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),

  spouseOrGuardianName: z.string().nullable(),
  monthlyIncome: z.number().nullable(),
  familyMembersCount: z.number().nullable(),
  familyTypeId: z.string().nullable(),
  childrenCount: z.number().nullable(),
  isDifferentlyAbled: z.boolean(),
  isExServiceman: z.boolean(),
  isSeniorCitizen: z.boolean(),

  mobile: z.string(),
  whatsappNumber: z.string().nullable(),
  email: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactMobile: z.string().nullable(),
  emergencyContactRelationship: z.string().nullable(),

  pincode: z.string().nullable(),
  addressLine: z.string().nullable(),
  landmark: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),

  sameAsCurrentAddress: z.boolean(),
  permPincode: z.string().nullable(),
  permAddressLine: z.string().nullable(),
  permLandmark: z.string().nullable(),

  aadhaarLast4: z.string().nullable(),
  pan: z.string().nullable(),
  voterId: z.string().nullable(),
  passportNumber: z.string().nullable(),
  drivingLicenceNumber: z.string().nullable(),

  educationId: z.string().nullable(),
  occupationId: z.string().nullable(),
  qualificationDetail: z.string().nullable(),

  languagesKnown: z.array(z.string()),
  skills: z.array(z.string()),

  religionId: z.string().nullable(),
  casteCategoryId: z.string().nullable(),
  businessTypeId: z.string().nullable(),
  membershipCategoryId: z.string().nullable(),
  branchId: z.string().nullable(),
  referralMemberId: z.string().nullable(),
  referralCode: z.string().nullable(),
  referralPointsBalance: z.number(),

  socialMediaLinks: z.string().nullable(),

  declarationInfoCorrect: z.boolean(),
  declarationAcceptConstitution: z.boolean(),
  declarationAcceptPrivacyPolicy: z.boolean(),
  declarationAcceptTerms: z.boolean(),
  declarationPlace: z.string().nullable(),
  declarationDate: z.date().nullable(),

  nominee: nomineeResponseSchema.nullable(),

  planId: z.string().nullable(),
  planName: z.string().nullable(),
  planTier: planTierSchema.nullable(),
  kycStatus: kycStatusSchema,
  pointsConverted: z.number(),
  totalWithdrawnAmount: z.number(),
  feeOverride: z.number().nullable(),
  paymentFrequency: paymentFrequencySchema.nullable(),
  unit: z.string().nullable(),
  membershipRemarks: z.string().nullable(),
  joiningDate: z.date().nullable(),
  validUntil: z.date().nullable(),
  status: memberStatusSchema,
  createdById: z.string(),
  approvedById: z.string().nullable(),
  approvedAt: z.date().nullable(),
  selfRegistered: z.boolean(),
  promotedToUserId: z.string().nullable(),
  createdAt: z.date(),
});
export type MemberResponse = z.infer<typeof memberResponseSchema>;

// Result of an OCR auto-fill attempt (see apps/api/src/ocr). Every field is
// nullable because the default provider is a no-op stub — real extraction
// only fills in what it could confidently read from the document.
export const identityAutoFillResponseSchema = z.object({
  fullName: z.string().nullable(),
  dob: z.coerce.date().nullable(),
  gender: genderSchema.nullable(),
  aadhaarNumber: z.string().nullable(),
  pan: z.string().nullable(),
  voterId: z.string().nullable(),
  passportNumber: z.string().nullable(),
  drivingLicenceNumber: z.string().nullable(),
});
export type IdentityAutoFillResponse = z.infer<typeof identityAutoFillResponseSchema>;

export const dedupeCheckSchema = z.object({
  mobile: z.string().optional(),
  aadhaarNumber: z.string().regex(/^\d{12}$/).optional(),
  fullName: z.string().optional(),
});
export type DedupeCheckInput = z.infer<typeof dedupeCheckSchema>;

export interface DedupeMatch {
  id: string;
  fullName: string;
  status: MemberStatus;
  matchedOn: "mobile" | "aadhaar" | "name";
}

// Promotes an ACTIVE member to a Field Executive staff account — the admin
// supplies login credentials since Member accounts log in with mobile+
// password while staff User accounts require an email.
export const promoteToExecutiveSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type PromoteToExecutiveInput = z.infer<typeof promoteToExecutiveSchema>;
