import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { CryptoService } from "../apps/api/src/common/crypto.service";
import { AadhaarHashService } from "../apps/api/src/common/aadhaar-hash.service";

const prisma = new PrismaClient();
// Same fallback as docker/docker-compose.yml's ${FEATURE_FLAG_ENCRYPTION_KEY:-...}
// substitution, so locally-seeded ciphertext stays decryptable by whichever
// key the API container actually ends up running with.
const crypto = new CryptoService({
  getOrThrow: () => process.env.FEATURE_FLAG_ENCRYPTION_KEY ?? "change-me-feature-flag-encryption-key",
} as never);
const aadhaarHasher = new AadhaarHashService({
  getOrThrow: () => process.env.AADHAAR_HASH_SECRET ?? "change-me-aadhaar-hash-secret",
} as never);

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: {},
    create: {
      id: "seed-org",
      name: "Vedvriksha",
    },
  });
  console.log(`Seeded organization: ${org.name} (${org.id})`);

  await prisma.orgSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      contactEmail: "info@vedvriksha.org",
      referralProgramEnabled: true,
      referralRequireActiveReferrerPlan: true,
      pointsToMoneyRatioPoints: 100,
      pointsToMoneyRatioAmount: 10,
      kycRequireAadhaar: true,
      kycRequirePan: false,
      kycRequireBankOrUpi: true,
      withdrawalMinAmount: 100,
      withdrawalMaxAmount: 5000,
      withdrawalFrequencyDays: 30,
      withdrawalChargeType: "FLAT",
      withdrawalChargeValue: 5,
    },
  });

  const adminEmail = "admin@example.com";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await argon2.hash("ChangeMe123!"),
      role: "SUPER_ADMIN",
      organizationId: org.id,
    },
  });
  console.log(`Seeded user: ${admin.email} (${admin.role}) — password: ChangeMe123!`);

  const fieldExecEmail = "field.exec@example.com";
  const fieldExec = await prisma.user.upsert({
    where: { email: fieldExecEmail },
    update: {},
    create: {
      email: fieldExecEmail,
      passwordHash: await argon2.hash("ChangeMe123!"),
      role: "FIELD_EXECUTIVE",
      organizationId: org.id,
    },
  });
  console.log(`Seeded user: ${fieldExec.email} (${fieldExec.role}) — password: ChangeMe123!`);

  // --- Lookups ---
  const lookupSeeds: { category: string; values: string[] }[] = [
    { category: "OCCUPATION", values: ["Farmer", "Teacher", "Self-Employed", "Homemaker"] },
    { category: "EDUCATION", values: ["Below 10th", "10th Pass", "Graduate", "Post Graduate"] },
    { category: "BLOOD_GROUP", values: ["A+", "B+", "O+", "AB+"] },
    { category: "RELIGION", values: ["Hindu", "Muslim", "Christian", "Sikh"] },
    { category: "CASTE_CATEGORY", values: ["General", "OBC", "SC", "ST"] },
    { category: "BUSINESS_TYPE", values: ["Retail", "Agriculture", "Services"] },
    { category: "MEMBERSHIP_CATEGORY", values: ["General Member", "Life Member", "Honorary Member"] },
    { category: "BRANCH", values: ["Main Branch", "North Branch", "South Branch"] },
    { category: "FAMILY_TYPE", values: ["Nuclear", "Joint"] },
  ];

  const lookupIds: Record<string, string> = {};
  for (const { category, values } of lookupSeeds) {
    for (const value of values) {
      const lookup = await prisma.lookup.upsert({
        where: { organizationId_category_value: { organizationId: org.id, category: category as never, value } },
        update: {},
        create: { organizationId: org.id, category: category as never, value },
      });
      lookupIds[`${category}:${value}`] = lookup.id;
    }
  }
  console.log(`Seeded ${Object.keys(lookupIds).length} lookups`);

  // --- Membership plans ---
  const silverPlan = await prisma.membershipPlan.upsert({
    where: { id: "seed-plan-silver" },
    update: {},
    create: {
      id: "seed-plan-silver",
      organizationId: org.id,
      name: "Silver Membership",
      tier: "SILVER",
      fee: 500,
      validityType: "MONTHS",
      validityMonths: 12,
    },
  });
  const goldPlan = await prisma.membershipPlan.upsert({
    where: { id: "seed-plan-gold" },
    update: {},
    create: {
      id: "seed-plan-gold",
      organizationId: org.id,
      name: "Gold Membership",
      tier: "GOLD",
      fee: 1000,
      validityType: "MONTHS",
      validityMonths: 12,
    },
  });
  const platinumPlan = await prisma.membershipPlan.upsert({
    where: { id: "seed-plan-platinum" },
    update: {},
    create: {
      id: "seed-plan-platinum",
      organizationId: org.id,
      name: "Platinum Membership",
      tier: "PLATINUM",
      fee: 2000,
      validityType: "LIFETIME",
    },
  });
  console.log(`Seeded plans: ${silverPlan.name}, ${goldPlan.name}, ${platinumPlan.name}`);

  // --- Referral point rule matrix (referrer tier x referred tier) ---
  const referralPointMatrix: { referrerTier: "SILVER" | "GOLD" | "PLATINUM"; referredTier: "SILVER" | "GOLD" | "PLATINUM"; points: number }[] = [
    { referrerTier: "SILVER", referredTier: "SILVER", points: 10 },
    { referrerTier: "SILVER", referredTier: "GOLD", points: 20 },
    { referrerTier: "SILVER", referredTier: "PLATINUM", points: 30 },
    { referrerTier: "GOLD", referredTier: "SILVER", points: 15 },
    { referrerTier: "GOLD", referredTier: "GOLD", points: 30 },
    { referrerTier: "GOLD", referredTier: "PLATINUM", points: 45 },
    { referrerTier: "PLATINUM", referredTier: "SILVER", points: 20 },
    { referrerTier: "PLATINUM", referredTier: "GOLD", points: 40 },
    { referrerTier: "PLATINUM", referredTier: "PLATINUM", points: 60 },
  ];
  for (const rule of referralPointMatrix) {
    await prisma.referralPointRule.upsert({
      where: {
        organizationId_referrerTier_referredTier: {
          organizationId: org.id,
          referrerTier: rule.referrerTier,
          referredTier: rule.referredTier,
        },
      },
      update: {},
      create: { organizationId: org.id, ...rule },
    });
  }
  console.log(`Seeded ${referralPointMatrix.length} referral point rules`);

  // --- Members ---
  const membersData = [
    {
      id: "seed-member-1",
      fullName: "Ramesh Kumar",
      mobile: "9876500001",
      email: "ramesh.kumar@example.com",
      gender: "MALE",
      status: "ACTIVE",
      plan: silverPlan,
      occupation: "Farmer",
      education: "10th Pass",
    },
    {
      id: "seed-member-2",
      fullName: "Sunita Devi",
      mobile: "9876500002",
      email: "sunita.devi@example.com",
      gender: "FEMALE",
      status: "ACTIVE",
      plan: platinumPlan,
      occupation: "Homemaker",
      education: "Graduate",
    },
    {
      id: "seed-member-3",
      fullName: "Vikram Singh",
      mobile: "9876500003",
      email: null,
      gender: "MALE",
      status: "SUBMITTED",
      plan: goldPlan,
      occupation: "Self-Employed",
      education: "Graduate",
    },
    {
      id: "seed-member-4",
      fullName: "Priya Sharma",
      mobile: "9876500004",
      email: null,
      gender: "FEMALE",
      status: "DRAFT",
      plan: silverPlan,
      occupation: "Teacher",
      education: "Post Graduate",
    },
    {
      id: "seed-member-5",
      fullName: "Anil Yadav",
      mobile: "9876500005",
      email: null,
      gender: "MALE",
      status: "REJECTED",
      plan: goldPlan,
      occupation: "Farmer",
      education: "Below 10th",
    },
  ] as const;

  const createdMembers: Record<string, { id: string }> = {};
  let seq = 1;
  for (const m of membersData) {
    const isActive = m.status === "ACTIVE";
    const member = await prisma.member.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        organizationId: org.id,
        fullName: m.fullName,
        mobile: m.mobile,
        email: m.email,
        gender: m.gender as never,
        status: m.status as never,
        registrationNumber: `REG-2026-${String(seq).padStart(4, "0")}`,
        membershipNumber: isActive ? `MEM-2026-${String(seq).padStart(4, "0")}` : null,
        planId: m.plan.id,
        occupationId: lookupIds[`OCCUPATION:${m.occupation}`],
        educationId: lookupIds[`EDUCATION:${m.education}`],
        membershipCategoryId: lookupIds["MEMBERSHIP_CATEGORY:General Member"],
        branchId: lookupIds["BRANCH:Main Branch"],
        createdById: fieldExec.id,
        approvedById: isActive ? admin.id : null,
        approvedAt: isActive ? new Date() : null,
        joiningDate: isActive ? new Date() : null,
        declarationInfoCorrect: true,
        declarationAcceptConstitution: true,
        declarationAcceptPrivacyPolicy: true,
        declarationAcceptTerms: true,
      },
    });
    createdMembers[m.id] = member;
    seq++;
  }
  console.log(`Seeded ${Object.keys(createdMembers).length} members`);

  // --- Payments for active members ---
  let receiptSeq = 1;
  for (const m of membersData.filter((x) => x.status === "ACTIVE")) {
    await prisma.payment.upsert({
      where: { receiptNumber: `RCPT-2026-${String(receiptSeq).padStart(4, "0")}` },
      update: {},
      create: {
        organizationId: org.id,
        memberId: createdMembers[m.id].id,
        amount: m.plan.fee,
        mode: "CASH",
        receiptNumber: `RCPT-2026-${String(receiptSeq).padStart(4, "0")}`,
        receivedById: fieldExec.id,
      },
    });
    receiptSeq++;
  }
  console.log(`Seeded payments for active members`);

  // --- KYC + Withdrawals (seed-member-1 gets a full, testable wallet) ---
  const ramesh = createdMembers["seed-member-1"];
  const sunita = createdMembers["seed-member-2"];

  // Aadhaar on file for both — required for isKycComplete() to actually pass
  // (OrgSettings.kycRequireAadhaar defaults to true), so Ramesh's VERIFIED
  // status below genuinely satisfies today's requirements, not just at the
  // moment he was verified.
  const rameshAadhaar = "234567890123";
  const sunitaAadhaar = "345678901234";
  await prisma.member.update({
    where: { id: ramesh.id },
    data: { aadhaarHash: aadhaarHasher.hash(rameshAadhaar), aadhaarLast4: aadhaarHasher.last4(rameshAadhaar) },
  });
  await prisma.member.update({
    where: { id: sunita.id },
    data: { aadhaarHash: aadhaarHasher.hash(sunitaAadhaar), aadhaarLast4: aadhaarHasher.last4(sunitaAadhaar) },
  });

  // 1000 points earned via a manual adjustment (mirrors what
  // ReferralsService.creditPoints would produce for a real earning event).
  // Guarded by a fixed-id upsert + existence check so re-running the seed
  // never double-credits the balance (unlike the rest of this ledger table,
  // there's no natural business-key unique constraint to upsert on here).
  const existingStartingLedgerEntry = await prisma.referralPointsLedger.findUnique({
    where: { id: "seed-ledger-starting-balance" },
  });
  if (!existingStartingLedgerEntry) {
    await prisma.member.update({
      where: { id: ramesh.id },
      data: { referralPointsBalance: { increment: 1000 } },
    });
    await prisma.referralPointsLedger.create({
      data: {
        id: "seed-ledger-starting-balance",
        organizationId: org.id,
        memberId: ramesh.id,
        points: 1000,
        reason: "MANUAL_ADJUSTMENT",
        note: "Seed data — starting balance",
        createdById: admin.id,
      },
    });
  }

  // Ramesh: VERIFIED KYC with bank payout details.
  const rameshAccountNumber = "1234567890123456";
  await prisma.member.update({
    where: { id: ramesh.id },
    data: {
      kycStatus: "VERIFIED",
      kycReviewedById: admin.id,
      kycReviewedAt: new Date(),
      payoutMethod: "BANK",
      bankAccountName: "Ramesh Kumar",
      bankAccountNumberEncrypted: crypto.encrypt(rameshAccountNumber),
      bankAccountNumberLast4: rameshAccountNumber.slice(-4),
      bankIfscCode: "SBIN0001234",
      bankName: "State Bank of India",
    },
  });

  // Sunita: PENDING KYC with UPI payout — gives the admin KYC queue a real
  // item to review right after seeding.
  await prisma.member.update({
    where: { id: sunita.id },
    data: { kycStatus: "PENDING", payoutMethod: "UPI", upiId: "sunita.devi@upi" },
  });
  console.log("Seeded KYC: Ramesh Kumar (VERIFIED, bank), Sunita Devi (PENDING, UPI)");

  // Withdrawal requests, one per status, against Ramesh's 1000-point balance
  // — chargeType/Amount computed from the FLAT ₹5 charge configured above.
  await prisma.withdrawalRequest.upsert({
    where: { id: "seed-withdrawal-pending" },
    update: {},
    create: {
      id: "seed-withdrawal-pending",
      organizationId: org.id,
      memberId: ramesh.id,
      pointsRequested: 200,
      grossAmount: 20,
      chargeType: "FLAT",
      chargeAmount: 5,
      netAmount: 15,
      payoutMethod: "BANK",
      payoutBankAccountName: "Ramesh Kumar",
      payoutBankAccountNumberLast4: rameshAccountNumber.slice(-4),
      payoutBankIfscCode: "SBIN0001234",
      payoutBankName: "State Bank of India",
      status: "PENDING",
    },
  });
  await prisma.withdrawalRequest.upsert({
    where: { id: "seed-withdrawal-approved" },
    update: {},
    create: {
      id: "seed-withdrawal-approved",
      organizationId: org.id,
      memberId: ramesh.id,
      pointsRequested: 150,
      grossAmount: 15,
      chargeType: "FLAT",
      chargeAmount: 5,
      netAmount: 10,
      payoutMethod: "BANK",
      payoutBankAccountName: "Ramesh Kumar",
      payoutBankAccountNumberLast4: rameshAccountNumber.slice(-4),
      payoutBankIfscCode: "SBIN0001234",
      payoutBankName: "State Bank of India",
      status: "APPROVED",
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });
  await prisma.withdrawalRequest.upsert({
    where: { id: "seed-withdrawal-rejected" },
    update: {},
    create: {
      id: "seed-withdrawal-rejected",
      organizationId: org.id,
      memberId: ramesh.id,
      pointsRequested: 100,
      grossAmount: 10,
      chargeType: "FLAT",
      chargeAmount: 5,
      netAmount: 5,
      payoutMethod: "BANK",
      payoutBankAccountName: "Ramesh Kumar",
      payoutBankAccountNumberLast4: rameshAccountNumber.slice(-4),
      payoutBankIfscCode: "SBIN0001234",
      payoutBankName: "State Bank of India",
      status: "REJECTED",
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewNote: "Bank details could not be verified",
    },
  });
  const paidWithdrawal = await prisma.withdrawalRequest.upsert({
    where: { id: "seed-withdrawal-paid" },
    update: {},
    create: {
      id: "seed-withdrawal-paid",
      organizationId: org.id,
      memberId: ramesh.id,
      pointsRequested: 100,
      grossAmount: 10,
      chargeType: "FLAT",
      chargeAmount: 5,
      netAmount: 5,
      payoutMethod: "BANK",
      payoutBankAccountName: "Ramesh Kumar",
      payoutBankAccountNumberLast4: rameshAccountNumber.slice(-4),
      payoutBankIfscCode: "SBIN0001234",
      payoutBankName: "State Bank of India",
      status: "PAID",
      reviewedById: admin.id,
      reviewedAt: new Date(),
      paidById: admin.id,
      paidAt: new Date(),
      paymentReference: "UTR1234567890",
    },
  });
  // Keep Ramesh's cached balances + ledger consistent with what
  // WithdrawalsService.markPaid would actually produce for the PAID request
  // — guarded the same way as the starting balance above, so re-seeding
  // never double-applies the increment (the ledger row itself is naturally
  // idempotent via the relatedWithdrawalRequestId unique constraint, but the
  // member balance increment needs its own explicit guard).
  const existingPaidLedgerEntry = await prisma.referralPointsLedger.findUnique({
    where: { relatedWithdrawalRequestId: paidWithdrawal.id },
  });
  if (!existingPaidLedgerEntry) {
    await prisma.member.update({
      where: { id: ramesh.id },
      data: { pointsConverted: { increment: 100 }, totalWithdrawnAmount: { increment: 5 } },
    });
    await prisma.referralPointsLedger.create({
      data: {
        organizationId: org.id,
        memberId: ramesh.id,
        points: -100,
        reason: "WITHDRAWAL_CONVERTED",
        status: "CONVERTED",
        relatedWithdrawalRequestId: paidWithdrawal.id,
      },
    });
  }
  console.log("Seeded 4 withdrawal requests (PENDING/APPROVED/REJECTED/PAID) for Ramesh Kumar");

  // --- Events ---
  const upcomingEvent = await prisma.event.upsert({
    where: { id: "seed-event-1" },
    update: {},
    create: {
      id: "seed-event-1",
      organizationId: org.id,
      title: "Tree Plantation Drive",
      description: "Community tree plantation event",
      location: "Main Branch Grounds",
      startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "PLANNED",
      targetDescription: "Plant saplings",
      targetQuantity: 50,
      pointsReward: 20,
      createdById: admin.id,
    },
  });
  // Per-tier reward override for the plantation drive — Silver=1x, Gold=2x,
  // Platinum=3x the base pointsReward, illustrating the spec's example.
  const eventRewardRules: { tier: "SILVER" | "GOLD" | "PLATINUM"; points: number }[] = [
    { tier: "SILVER", points: 20 },
    { tier: "GOLD", points: 40 },
    { tier: "PLATINUM", points: 60 },
  ];
  for (const rule of eventRewardRules) {
    await prisma.eventRewardRule.upsert({
      where: { eventId_tier: { eventId: upcomingEvent.id, tier: rule.tier } },
      update: {},
      create: { organizationId: org.id, eventId: upcomingEvent.id, ...rule },
    });
  }
  console.log(`Seeded ${eventRewardRules.length} event reward rules`);

  const pastEvent = await prisma.event.upsert({
    where: { id: "seed-event-2" },
    update: {},
    create: {
      id: "seed-event-2",
      organizationId: org.id,
      title: "Annual General Meeting",
      description: "Yearly membership meeting",
      location: "Community Hall",
      startAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      status: "COMPLETED",
      createdById: admin.id,
    },
  });
  console.log(`Seeded events: ${upcomingEvent.title}, ${pastEvent.title}`);

  for (const m of membersData.filter((x) => x.status === "ACTIVE")) {
    await prisma.eventRegistration.upsert({
      where: { eventId_memberId: { eventId: pastEvent.id, memberId: createdMembers[m.id].id } },
      update: {},
      create: {
        eventId: pastEvent.id,
        memberId: createdMembers[m.id].id,
        attended: true,
      },
    });
  }
  console.log(`Seeded event registrations`);

  // --- Notices ---
  await prisma.notice.upsert({
    where: { id: "seed-notice-1" },
    update: {},
    create: {
      id: "seed-notice-1",
      organizationId: org.id,
      title: "Welcome to NMMS",
      body: "This is a sample notice published for all members.",
      createdById: admin.id,
      publishedAt: new Date(),
    },
  });
  console.log(`Seeded notices`);

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
