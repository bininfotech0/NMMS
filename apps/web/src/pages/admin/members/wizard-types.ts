import type { Dispatch, SetStateAction } from "react";
import type { MemberResponse, UpdateMemberInput } from "@nmms/shared";

// All fields are plain strings/booleans for direct binding to controlled
// inputs; dates use "YYYY-MM-DD" (native <input type="date"> format) and are
// converted to/from Date objects only at the form<->API boundary.
export interface WizardFormState {
  // Step 1 — Membership
  planId: string;
  membershipCategoryId: string;
  branchId: string;
  joiningDate: string;
  referralMemberId: string;
  feeOverride: string;
  paymentFrequency: string;
  unit: string;
  membershipRemarks: string;

  // Step 2 — Basic Information
  fullName: string;
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dob: string;
  maritalStatus: string;
  bloodGroup: string;
  nationality: string;
  religionId: string;
  casteCategoryId: string;

  // Step 3 — Personal Information
  fatherName: string;
  motherName: string;
  spouseOrGuardianName: string;
  familyTypeId: string;
  monthlyIncome: string;
  familyMembersCount: string;
  childrenCount: string;
  isDifferentlyAbled: boolean;
  isExServiceman: boolean;
  isSeniorCitizen: boolean;

  // Step 4 — Contact & Address
  mobile: string;
  whatsappNumber: string;
  email: string;
  pincode: string;
  addressLine: string;
  landmark: string;
  latitude: string;
  longitude: string;
  sameAsCurrentAddress: boolean;
  permPincode: string;
  permAddressLine: string;
  permLandmark: string;

  // Step 5 — Education & Occupation
  educationId: string;
  occupationId: string;
  qualificationDetail: string;
  businessTypeId: string;
  // Comma-separated free-form tags — stored as string[] on the backend, split
  // into an array only at the form -> DTO boundary (see wizardFormToUpdateDto).
  languagesKnown: string;
  skills: string;

  // Step 6 — Identity & Documents
  // "AUTO_FILL" | "MANUAL" | "" — see StepDocuments' entry-method toggle.
  identityEntryMethod: string;
  aadhaarNumber: string;
  pan: string;
  voterId: string;
  passportNumber: string;
  drivingLicenceNumber: string;

  socialMediaLinks: string;

  // Step 8 — Nominee & Emergency Contact
  emergencyContactName: string;
  emergencyContactMobile: string;
  emergencyContactRelationship: string;
  nomineeName: string;
  nomineeRelationship: string;
  nomineeDob: string;
  nomineeAddress: string;
  nomineeMobile: string;

  // Step 9 — Declaration & Signature
  declarationInfoCorrect: boolean;
  declarationAcceptConstitution: boolean;
  declarationAcceptPrivacyPolicy: boolean;
  declarationAcceptTerms: boolean;
  declarationPlace: string;
  declarationDate: string;
}

export function emptyWizardForm(): WizardFormState {
  return {
    planId: "",
    membershipCategoryId: "",
    branchId: "",
    joiningDate: "",
    referralMemberId: "",
    feeOverride: "",
    paymentFrequency: "",
    unit: "",
    membershipRemarks: "",
    fullName: "",
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dob: "",
    maritalStatus: "",
    bloodGroup: "",
    nationality: "",
    religionId: "",
    casteCategoryId: "",
    fatherName: "",
    motherName: "",
    spouseOrGuardianName: "",
    familyTypeId: "",
    monthlyIncome: "",
    familyMembersCount: "",
    childrenCount: "",
    isDifferentlyAbled: false,
    isExServiceman: false,
    isSeniorCitizen: false,
    mobile: "",
    whatsappNumber: "",
    email: "",
    pincode: "",
    addressLine: "",
    landmark: "",
    latitude: "",
    longitude: "",
    sameAsCurrentAddress: false,
    permPincode: "",
    permAddressLine: "",
    permLandmark: "",
    educationId: "",
    occupationId: "",
    qualificationDetail: "",
    businessTypeId: "",
    languagesKnown: "",
    skills: "",
    identityEntryMethod: "",
    aadhaarNumber: "",
    pan: "",
    voterId: "",
    passportNumber: "",
    drivingLicenceNumber: "",
    socialMediaLinks: "",
    emergencyContactName: "",
    emergencyContactMobile: "",
    emergencyContactRelationship: "",
    nomineeName: "",
    nomineeRelationship: "",
    nomineeDob: "",
    nomineeAddress: "",
    nomineeMobile: "",
    declarationInfoCorrect: false,
    declarationAcceptConstitution: false,
    declarationAcceptPrivacyPolicy: false,
    declarationAcceptTerms: false,
    declarationPlace: "",
    declarationDate: "",
  };
}

function dateToInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function inputToDate(s: string): Date | null {
  return s ? new Date(s) : null;
}

function numberToInput(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

function inputToNumber(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function tagsToInput(tags: string[]): string {
  return tags.join(", ");
}

// Derives fullName from its parts so the wizard never asks for the same
// name twice — StepBasicInfo calls this on every title/firstName/
// middleName/lastName change instead of exposing a separate free-text field.
export function composeFullName(parts: {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
}): string {
  return [parts.title, parts.firstName, parts.middleName, parts.lastName]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

// Members created before name parts existed (or via the single-field
// "Add member" sheet) only have fullName set. Split it once so the wizard's
// auto-derive doesn't clobber an already-entered name the first time the
// user edits any single part.
function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (words.length === 1) return { firstName: words[0], middleName: "", lastName: "" };
  return {
    firstName: words[0],
    middleName: words.slice(1, -1).join(" "),
    lastName: words[words.length - 1],
  };
}

function inputToTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function memberToWizardForm(member: MemberResponse): WizardFormState {
  const hasNameParts = member.firstName || member.middleName || member.lastName;
  const nameParts = hasNameParts
    ? { firstName: member.firstName ?? "", middleName: member.middleName ?? "", lastName: member.lastName ?? "" }
    : splitFullName(member.fullName);
  return {
    planId: member.planId ?? "",
    membershipCategoryId: member.membershipCategoryId ?? "",
    branchId: member.branchId ?? "",
    joiningDate: dateToInput(member.joiningDate),
    referralMemberId: member.referralMemberId ?? "",
    feeOverride: numberToInput(member.feeOverride),
    paymentFrequency: member.paymentFrequency ?? "",
    unit: member.unit ?? "",
    membershipRemarks: member.membershipRemarks ?? "",
    fullName: member.fullName,
    title: member.title ?? "",
    firstName: nameParts.firstName,
    middleName: nameParts.middleName,
    lastName: nameParts.lastName,
    gender: member.gender ?? "",
    dob: dateToInput(member.dob),
    maritalStatus: member.maritalStatus ?? "",
    bloodGroup: member.bloodGroup ?? "",
    nationality: member.nationality ?? "",
    religionId: member.religionId ?? "",
    casteCategoryId: member.casteCategoryId ?? "",
    fatherName: member.fatherName ?? "",
    motherName: member.motherName ?? "",
    spouseOrGuardianName: member.spouseOrGuardianName ?? "",
    familyTypeId: member.familyTypeId ?? "",
    monthlyIncome: numberToInput(member.monthlyIncome),
    familyMembersCount: numberToInput(member.familyMembersCount),
    childrenCount: numberToInput(member.childrenCount),
    isDifferentlyAbled: member.isDifferentlyAbled,
    isExServiceman: member.isExServiceman,
    isSeniorCitizen: member.isSeniorCitizen,
    mobile: member.mobile,
    whatsappNumber: member.whatsappNumber ?? "",
    email: member.email ?? "",
    pincode: member.pincode ?? "",
    addressLine: member.addressLine ?? "",
    landmark: member.landmark ?? "",
    latitude: numberToInput(member.latitude),
    longitude: numberToInput(member.longitude),
    sameAsCurrentAddress: member.sameAsCurrentAddress,
    permPincode: member.permPincode ?? "",
    permAddressLine: member.permAddressLine ?? "",
    permLandmark: member.permLandmark ?? "",
    educationId: member.educationId ?? "",
    occupationId: member.occupationId ?? "",
    qualificationDetail: member.qualificationDetail ?? "",
    businessTypeId: member.businessTypeId ?? "",
    languagesKnown: tagsToInput(member.languagesKnown),
    skills: tagsToInput(member.skills),
    identityEntryMethod: member.identityEntryMethod ?? "",
    // Aadhaar is write-only server-side (only last4 comes back) — never
    // pre-fill it from a fetched member, that'd show a wrong/incomplete value.
    aadhaarNumber: "",
    pan: member.pan ?? "",
    voterId: member.voterId ?? "",
    passportNumber: member.passportNumber ?? "",
    drivingLicenceNumber: member.drivingLicenceNumber ?? "",
    socialMediaLinks: member.socialMediaLinks ?? "",
    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactMobile: member.emergencyContactMobile ?? "",
    emergencyContactRelationship: member.emergencyContactRelationship ?? "",
    nomineeName: member.nominee?.name ?? "",
    nomineeRelationship: member.nominee?.relationship ?? "",
    nomineeDob: dateToInput(member.nominee?.dob),
    nomineeAddress: member.nominee?.address ?? "",
    nomineeMobile: member.nominee?.mobile ?? "",
    declarationInfoCorrect: member.declarationInfoCorrect,
    declarationAcceptConstitution: member.declarationAcceptConstitution,
    declarationAcceptPrivacyPolicy: member.declarationAcceptPrivacyPolicy,
    declarationAcceptTerms: member.declarationAcceptTerms,
    declarationPlace: member.declarationPlace ?? "",
    declarationDate: dateToInput(member.declarationDate),
  };
}

// Sends the whole form on every step save — PATCH is idempotent and this
// keeps every step's "Save & Continue" handler identical rather than tracking
// a per-step field allowlist.
export function wizardFormToUpdateDto(form: WizardFormState): UpdateMemberInput {
  return {
    planId: form.planId || null,
    membershipCategoryId: form.membershipCategoryId || null,
    branchId: form.branchId || null,
    joiningDate: inputToDate(form.joiningDate),
    referralMemberId: form.referralMemberId || null,
    feeOverride: inputToNumber(form.feeOverride),
    paymentFrequency: (form.paymentFrequency || null) as UpdateMemberInput["paymentFrequency"],
    unit: form.unit || null,
    membershipRemarks: form.membershipRemarks || null,
    fullName: form.fullName,
    title: form.title || null,
    firstName: form.firstName || null,
    middleName: form.middleName || null,
    lastName: form.lastName || null,
    gender: (form.gender || null) as UpdateMemberInput["gender"],
    dob: inputToDate(form.dob),
    maritalStatus: (form.maritalStatus || null) as UpdateMemberInput["maritalStatus"],
    bloodGroup: form.bloodGroup || null,
    nationality: form.nationality || null,
    religionId: form.religionId || null,
    casteCategoryId: form.casteCategoryId || null,
    fatherName: form.fatherName || null,
    motherName: form.motherName || null,
    spouseOrGuardianName: form.spouseOrGuardianName || null,
    familyTypeId: form.familyTypeId || null,
    monthlyIncome: inputToNumber(form.monthlyIncome),
    familyMembersCount: inputToNumber(form.familyMembersCount),
    childrenCount: inputToNumber(form.childrenCount),
    isDifferentlyAbled: form.isDifferentlyAbled,
    isExServiceman: form.isExServiceman,
    isSeniorCitizen: form.isSeniorCitizen,
    mobile: form.mobile,
    whatsappNumber: form.whatsappNumber || null,
    email: form.email || null,
    pincode: form.pincode || null,
    addressLine: form.addressLine || null,
    landmark: form.landmark || null,
    latitude: inputToNumber(form.latitude),
    longitude: inputToNumber(form.longitude),
    sameAsCurrentAddress: form.sameAsCurrentAddress,
    permPincode: (form.sameAsCurrentAddress ? form.pincode : form.permPincode) || null,
    permAddressLine: (form.sameAsCurrentAddress ? form.addressLine : form.permAddressLine) || null,
    permLandmark: (form.sameAsCurrentAddress ? form.landmark : form.permLandmark) || null,
    educationId: form.educationId || null,
    occupationId: form.occupationId || null,
    qualificationDetail: form.qualificationDetail || null,
    businessTypeId: form.businessTypeId || null,
    languagesKnown: inputToTags(form.languagesKnown),
    skills: inputToTags(form.skills),
    identityEntryMethod: (form.identityEntryMethod || null) as UpdateMemberInput["identityEntryMethod"],
    // Only send when the user actually typed a new one — an empty string
    // would otherwise clear the already-hashed Aadhaar on every save.
    aadhaarNumber: form.aadhaarNumber ? form.aadhaarNumber : undefined,
    pan: form.pan || null,
    voterId: form.voterId || null,
    passportNumber: form.passportNumber || null,
    drivingLicenceNumber: form.drivingLicenceNumber || null,
    socialMediaLinks: form.socialMediaLinks || null,
    emergencyContactName: form.emergencyContactName || null,
    emergencyContactMobile: form.emergencyContactMobile || null,
    emergencyContactRelationship: form.emergencyContactRelationship || null,
    // A name is required to save a nominee. If some other nominee field was
    // filled in but name was left blank, don't touch the saved nominee at
    // all (undefined) rather than wiping it out (null) — the user's partial
    // edit just doesn't get saved instead of silently deleting real data.
    nominee: form.nomineeName
      ? {
          name: form.nomineeName,
          relationship: form.nomineeRelationship || null,
          dob: inputToDate(form.nomineeDob),
          address: form.nomineeAddress || null,
          mobile: form.nomineeMobile || null,
        }
      : form.nomineeRelationship || form.nomineeDob || form.nomineeAddress || form.nomineeMobile
        ? undefined
        : null,
    declarationInfoCorrect: form.declarationInfoCorrect,
    declarationAcceptConstitution: form.declarationAcceptConstitution,
    declarationAcceptPrivacyPolicy: form.declarationAcceptPrivacyPolicy,
    declarationAcceptTerms: form.declarationAcceptTerms,
    declarationPlace: form.declarationPlace || null,
    declarationDate: inputToDate(form.declarationDate),
  };
}

export const WIZARD_STEP_TITLES = [
  "Membership",
  "Basic Information",
  "Personal Information",
  "Contact & Address",
  "Education & Occupation",
  "Payment Collection",
  "Identity & Documents",
  "Nominee & Emergency Contact",
  "Declaration & Signature",
  "Review & Submit",
] as const;

export interface StepProps {
  form: WizardFormState;
  setForm: Dispatch<SetStateAction<WizardFormState>>;
  memberId: string;
}
