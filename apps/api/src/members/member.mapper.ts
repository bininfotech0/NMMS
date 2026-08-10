import type { Member, MembershipPlan, Nominee } from "@prisma/client";
import type { MemberResponse } from "@nmms/shared";

type MemberWithNominee = Member & {
  nominee?: Nominee | null;
  plan?: Pick<MembershipPlan, "name" | "tier"> | null;
};

export function toMemberResponse(member: MemberWithNominee): MemberResponse {
  return {
    id: member.id,
    membershipNumber: member.membershipNumber,
    registrationNumber: member.registrationNumber,
    registrationLatitude: member.registrationLatitude,
    registrationLongitude: member.registrationLongitude,
    deviceId: member.deviceId,
    registrationMode: member.registrationMode as MemberResponse["registrationMode"],
    registeredAt: member.registeredAt,
    identityEntryMethod: member.identityEntryMethod as MemberResponse["identityEntryMethod"],
    fullName: member.fullName,
    title: member.title,
    firstName: member.firstName,
    middleName: member.middleName,
    lastName: member.lastName,
    dob: member.dob,
    gender: member.gender as MemberResponse["gender"],
    maritalStatus: member.maritalStatus as MemberResponse["maritalStatus"],
    bloodGroup: member.bloodGroup,
    nationality: member.nationality,
    fatherName: member.fatherName,
    motherName: member.motherName,

    spouseOrGuardianName: member.spouseOrGuardianName,
    monthlyIncome: member.monthlyIncome?.toNumber() ?? null,
    familyMembersCount: member.familyMembersCount,
    familyTypeId: member.familyTypeId,
    childrenCount: member.childrenCount,
    isDifferentlyAbled: member.isDifferentlyAbled,
    isExServiceman: member.isExServiceman,
    isSeniorCitizen: member.isSeniorCitizen,

    mobile: member.mobile,
    whatsappNumber: member.whatsappNumber,
    email: member.email,
    emergencyContactName: member.emergencyContactName,
    emergencyContactMobile: member.emergencyContactMobile,
    emergencyContactRelationship: member.emergencyContactRelationship,

    pincode: member.pincode,
    addressLine: member.addressLine,
    landmark: member.landmark,
    latitude: member.latitude,
    longitude: member.longitude,

    sameAsCurrentAddress: member.sameAsCurrentAddress,
    permPincode: member.permPincode,
    permAddressLine: member.permAddressLine,
    permLandmark: member.permLandmark,

    aadhaarLast4: member.aadhaarLast4,
    pan: member.pan,
    voterId: member.voterId,
    passportNumber: member.passportNumber,
    drivingLicenceNumber: member.drivingLicenceNumber,

    educationId: member.educationId,
    occupationId: member.occupationId,
    qualificationDetail: member.qualificationDetail,

    languagesKnown: member.languagesKnown,
    skills: member.skills,

    religionId: member.religionId,
    casteCategoryId: member.casteCategoryId,
    businessTypeId: member.businessTypeId,
    membershipCategoryId: member.membershipCategoryId,
    branchId: member.branchId,
    referralMemberId: member.referralMemberId,
    referralCode: member.referralCode,
    referralPointsBalance: member.referralPointsBalance,

    socialMediaLinks: member.socialMediaLinks,

    declarationInfoCorrect: member.declarationInfoCorrect,
    declarationAcceptConstitution: member.declarationAcceptConstitution,
    declarationAcceptPrivacyPolicy: member.declarationAcceptPrivacyPolicy,
    declarationAcceptTerms: member.declarationAcceptTerms,
    declarationPlace: member.declarationPlace,
    declarationDate: member.declarationDate,

    nominee: member.nominee
      ? {
          id: member.nominee.id,
          name: member.nominee.name,
          relationship: member.nominee.relationship,
          dob: member.nominee.dob,
          address: member.nominee.address,
          mobile: member.nominee.mobile,
        }
      : null,

    planId: member.planId,
    planName: member.plan?.name ?? null,
    planTier: (member.plan?.tier as MemberResponse["planTier"]) ?? null,
    kycStatus: member.kycStatus as MemberResponse["kycStatus"],
    pointsConverted: member.pointsConverted,
    totalWithdrawnAmount: member.totalWithdrawnAmount.toNumber(),
    feeOverride: member.feeOverride?.toNumber() ?? null,
    paymentFrequency: member.paymentFrequency as MemberResponse["paymentFrequency"],
    unit: member.unit,
    membershipRemarks: member.membershipRemarks,
    joiningDate: member.joiningDate,
    validUntil: member.validUntil,
    status: member.status as MemberResponse["status"],
    createdById: member.createdById,
    approvedById: member.approvedById,
    approvedAt: member.approvedAt,
    selfRegistered: member.selfRegistered,
    promotedToUserId: member.promotedToUserId,
    createdAt: member.createdAt,
  };
}
