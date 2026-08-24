import { Role, type AuthUser } from "@nmms/shared";

// A Decimal-like stub — real Prisma.Decimal instances have .toNumber(), and
// the mapper calls it on monthlyIncome/feeOverride.
export function decimal(value: number) {
  return { toNumber: () => value };
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "user@example.com",
    role: Role.SUPER_ADMIN,
    organizationId: "org-1",
    ...overrides,
  };
}

// Every field toMemberResponse() touches, defaulted to a DRAFT member with
// nothing filled in yet. Pass overrides for whatever the test cares about.
export function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-1",
    organizationId: "org-1",
    membershipNumber: null,
    registrationNumber: "REG-2026-00001",
    registrationLatitude: null,
    registrationLongitude: null,
    deviceId: null,
    registrationMode: "ONLINE",
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
    aadhaarHash: null,
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
    passwordHash: null,
    socialMediaLinks: null,
    declarationInfoCorrect: false,
    declarationAcceptConstitution: false,
    declarationAcceptPrivacyPolicy: false,
    declarationAcceptTerms: false,
    declarationPlace: null,
    declarationDate: null,
    nominee: null,
    planId: null,
    // Consumers that select { plan: { select: { tier, isActive } } } (e.g.
    // ReferralsService.awardPointsForApproval, PlanRewardsService) expect
    // this to be a plan-shaped object or null, not the full MembershipPlan —
    // pass an explicit `plan` override matching what your mock's `select`
    // needs.
    plan: null,
    kycStatus: "NOT_SUBMITTED",
    kycReviewedById: null,
    kycReviewedAt: null,
    kycReviewNote: null,
    payoutMethod: null,
    bankAccountName: null,
    bankAccountNumberEncrypted: null,
    bankAccountNumberLast4: null,
    bankIfscCode: null,
    bankName: null,
    upiId: null,
    pointsConverted: 0,
    totalWithdrawnAmount: decimal(0),
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
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Every field PlansService/PlanRewardsService touch, defaulted to an active
// untiered plan. Pass overrides for whatever the test cares about.
export function makeMembershipPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    organizationId: "org-1",
    name: "Test Plan",
    tier: null,
    fee: decimal(500),
    validityType: "MONTHS",
    validityMonths: 12,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Every field WithdrawalsService/withdrawal.mapper touch, defaulted to a
// PENDING bank-payout request. Pass overrides for whatever the test cares about.
export function makeWithdrawalRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "withdrawal-1",
    organizationId: "org-1",
    memberId: "member-1",
    member: { fullName: "Test Member" },
    pointsRequested: 100,
    grossAmount: decimal(10),
    chargeType: "NONE",
    chargeAmount: decimal(0),
    netAmount: decimal(10),
    payoutMethod: "BANK",
    payoutBankAccountName: "Test Member",
    payoutBankAccountNumberLast4: "3456",
    payoutBankIfscCode: "SBIN0001234",
    payoutBankName: "State Bank of India",
    payoutUpiId: null,
    status: "PENDING",
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    paidById: null,
    paidAt: null,
    paymentReference: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Every field DonationsService/donation.mapper touch, defaulted to a PENDING
// cash donation with no donor tax-receipt details. Pass overrides for
// whatever the test cares about.
export function makeDonation(overrides: Record<string, unknown> = {}) {
  return {
    id: "donation-1",
    organizationId: "org-1",
    memberId: "member-1",
    member: { fullName: "Test Member" },
    amount: decimal(500),
    mode: "CASH",
    note: null,
    reference: null,
    donorAddress: null,
    donorPan: null,
    status: "PENDING",
    receiptNumber: null,
    pointsAwarded: null,
    recordedById: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    gatewayOrderId: null,
    gatewayPaymentId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Minimal shape shared by both PrismaService and an interactive $transaction
// callback's `tx` argument — the services under test only ever touch the
// tables listed here.
export function makeMockPrisma() {
  const prisma = {
    member: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    statusHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    nominee: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    memberDocument: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    eventRegistration: {
      deleteMany: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    orgSettings: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    referralPointsLedger: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    referralReward: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    membershipPlan: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    eventRewardRule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    referralPointRule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    withdrawalRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    donation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  // Default: $transaction(cb) just runs cb with the same mock as `tx`.
  prisma.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === "function") {
      return (cb as (tx: typeof prisma) => unknown)(prisma);
    }
    // Array form: $transaction([...promises]) — resolve them all.
    return Promise.all(cb as Promise<unknown>[]);
  });
  return prisma;
}
