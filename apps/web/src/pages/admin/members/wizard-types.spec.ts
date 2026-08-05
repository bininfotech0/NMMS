import { describe, expect, it } from "vitest";
import type { MemberResponse } from "@nmms/shared";
import { emptyWizardForm, memberToWizardForm, wizardFormToUpdateDto } from "./wizard-types";

function makeMemberResponse(overrides: Partial<MemberResponse> = {}): MemberResponse {
  return {
    id: "member-1",
    membershipNumber: null,
    registrationNumber: "REG-2026-00001",
    registrationLatitude: null,
    registrationLongitude: null,
    deviceId: null,
    registrationMode: null,
    registeredAt: null,
    identityEntryMethod: null,
    fullName: "Test Member",
    title: null,
    firstName: null,
    middleName: null,
    lastName: null,
    dob: null,
    gender: null,
    maritalStatus: null,
    bloodGroup: null,
    nationality: null,
    fatherName: null,
    motherName: null,
    spouseOrGuardianName: null,
    monthlyIncome: null,
    familyMembersCount: null,
    familyTypeId: null,
    childrenCount: null,
    isDifferentlyAbled: false,
    isExServiceman: false,
    isSeniorCitizen: false,
    mobile: "9800000000",
    whatsappNumber: null,
    email: null,
    emergencyContactName: null,
    emergencyContactMobile: null,
    emergencyContactRelationship: null,
    pincode: null,
    addressLine: null,
    landmark: null,
    latitude: null,
    longitude: null,
    sameAsCurrentAddress: false,
    permPincode: null,
    permAddressLine: null,
    permLandmark: null,
    aadhaarLast4: null,
    pan: null,
    voterId: null,
    passportNumber: null,
    drivingLicenceNumber: null,
    educationId: null,
    occupationId: null,
    qualificationDetail: null,
    languagesKnown: [],
    skills: [],
    religionId: null,
    casteCategoryId: null,
    businessTypeId: null,
    membershipCategoryId: null,
    branchId: null,
    referralMemberId: null,
    referralCode: null,
    referralPointsBalance: 0,
    socialMediaLinks: null,
    declarationInfoCorrect: false,
    declarationAcceptConstitution: false,
    declarationAcceptPrivacyPolicy: false,
    declarationAcceptTerms: false,
    declarationPlace: null,
    declarationDate: null,
    nominee: null,
    planId: null,
    feeOverride: null,
    paymentFrequency: null,
    unit: null,
    membershipRemarks: null,
    joiningDate: null,
    validUntil: null,
    status: "DRAFT",
    createdById: "fe-1",
    approvedById: null,
    approvedAt: null,
    selfRegistered: false,
    promotedToUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("emptyWizardForm", () => {
  it("produces an all-blank form with no crashes", () => {
    const form = emptyWizardForm();
    expect(form.fullName).toBe("");
    expect(form.declarationInfoCorrect).toBe(false);
  });
});

describe("memberToWizardForm", () => {
  it("maps scalar and numeric fields into string inputs", () => {
    const member = makeMemberResponse({
      fullName: "Jane Doe",
      monthlyIncome: 10000,
      familyMembersCount: 4,
      latitude: 23.35,
      longitude: 85.33,
    });
    const form = memberToWizardForm(member);
    expect(form.fullName).toBe("Jane Doe");
    expect(form.monthlyIncome).toBe("10000");
    expect(form.familyMembersCount).toBe("4");
    expect(form.latitude).toBe("23.35");
    expect(form.longitude).toBe("85.33");
  });

  it("formats dates as YYYY-MM-DD for native date inputs", () => {
    const member = makeMemberResponse({ dob: new Date("1990-05-15T00:00:00.000Z") });
    expect(memberToWizardForm(member).dob).toBe("1990-05-15");
  });

  it("never pre-fills the write-only Aadhaar field, even if other identity fields are set", () => {
    const member = makeMemberResponse({ aadhaarLast4: "1234", pan: "ABCDE1234F" });
    const form = memberToWizardForm(member);
    expect(form.aadhaarNumber).toBe("");
    expect(form.pan).toBe("ABCDE1234F");
  });

  it("joins array fields (languagesKnown, skills) into comma-separated strings", () => {
    const member = makeMemberResponse({ languagesKnown: ["Hindi", "English"], skills: ["Teaching"] });
    const form = memberToWizardForm(member);
    expect(form.languagesKnown).toBe("Hindi, English");
    expect(form.skills).toBe("Teaching");
  });

  it("flattens a nested nominee onto top-level nominee* fields", () => {
    const member = makeMemberResponse({
      nominee: { id: "n1", name: "John Doe", relationship: "Father", dob: null, address: null, mobile: "9800000001" },
    });
    const form = memberToWizardForm(member);
    expect(form.nomineeName).toBe("John Doe");
    expect(form.nomineeRelationship).toBe("Father");
    expect(form.nomineeMobile).toBe("9800000001");
  });

  it("carries landmark and permLandmark through", () => {
    const member = makeMemberResponse({ landmark: "Near market", permLandmark: "Near school" });
    const form = memberToWizardForm(member);
    expect(form.landmark).toBe("Near market");
    expect(form.permLandmark).toBe("Near school");
  });
});

describe("wizardFormToUpdateDto", () => {
  it("converts blank string inputs to null, not empty strings", () => {
    const dto = wizardFormToUpdateDto(emptyWizardForm());
    expect(dto.planId).toBeNull();
    expect(dto.addressLine).toBeNull();
    expect(dto.landmark).toBeNull();
  });

  it("parses numeric inputs back to numbers", () => {
    const form = { ...emptyWizardForm(), monthlyIncome: "12000", familyMembersCount: "4" };
    const dto = wizardFormToUpdateDto(form);
    expect(dto.monthlyIncome).toBe(12000);
    expect(dto.familyMembersCount).toBe(4);
  });

  it("only sends aadhaarNumber when the user actually typed one (undefined otherwise, not null)", () => {
    const blank = wizardFormToUpdateDto(emptyWizardForm());
    expect(blank.aadhaarNumber).toBeUndefined();

    const typed = wizardFormToUpdateDto({ ...emptyWizardForm(), aadhaarNumber: "123456789012" });
    expect(typed.aadhaarNumber).toBe("123456789012");
  });

  it("omits the nominee entirely when no nominee name was entered", () => {
    const dto = wizardFormToUpdateDto(emptyWizardForm());
    expect(dto.nominee).toBeNull();
  });

  it("builds a nominee object once a name is entered", () => {
    const form = { ...emptyWizardForm(), nomineeName: "John Doe", nomineeRelationship: "Father" };
    const dto = wizardFormToUpdateDto(form);
    expect(dto.nominee).toEqual({
      name: "John Doe",
      relationship: "Father",
      dob: null,
      address: null,
      mobile: null,
    });
  });

  it("copies current address into permanent fields (incl. landmark) when sameAsCurrentAddress is checked", () => {
    const form = {
      ...emptyWizardForm(),
      sameAsCurrentAddress: true,
      addressLine: "123 Main St",
      landmark: "Near market",
      pincode: "834001",
      permAddressLine: "should-be-ignored",
    };
    const dto = wizardFormToUpdateDto(form);
    expect(dto.permAddressLine).toBe("123 Main St");
    expect(dto.permLandmark).toBe("Near market");
  });

  it("keeps permanent address fields independent when sameAsCurrentAddress is unchecked", () => {
    const form = {
      ...emptyWizardForm(),
      sameAsCurrentAddress: false,
      addressLine: "123 Main St",
      permAddressLine: "456 Other St",
      landmark: "Near market",
      permLandmark: "Near school",
    };
    const dto = wizardFormToUpdateDto(form);
    expect(dto.addressLine).toBe("123 Main St");
    expect(dto.permAddressLine).toBe("456 Other St");
    expect(dto.permLandmark).toBe("Near school");
  });

  it("splits comma-separated tag inputs back into trimmed arrays", () => {
    const form = { ...emptyWizardForm(), languagesKnown: "Hindi,  English ,Bhojpuri", skills: "" };
    const dto = wizardFormToUpdateDto(form);
    expect(dto.languagesKnown).toEqual(["Hindi", "English", "Bhojpuri"]);
    expect(dto.skills).toEqual([]);
  });
});

describe("memberToWizardForm -> wizardFormToUpdateDto round trip", () => {
  it("preserves core identity/membership fields end to end", () => {
    const member = makeMemberResponse({
      fullName: "Jane Doe",
      mobile: "9800000000",
      planId: "plan-1",
      familyTypeId: "family-type-1",
      monthlyIncome: 15000,
    });
    const dto = wizardFormToUpdateDto(memberToWizardForm(member));
    expect(dto.fullName).toBe("Jane Doe");
    expect(dto.mobile).toBe("9800000000");
    expect(dto.planId).toBe("plan-1");
    expect(dto.familyTypeId).toBe("family-type-1");
    expect(dto.monthlyIncome).toBe(15000);
  });
});
