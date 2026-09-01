import { ConflictException, NotFoundException } from "@nestjs/common";
import { Role } from "@nmms/shared";
import { MembersService } from "./members.service";
import { decimal, makeAuthUser, makeMember, makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  const aadhaar = { hash: jest.fn((v: string) => `hashed:${v}`), last4: jest.fn((v: string) => v.slice(-4)) };
  const numbering = { nextRegistrationNumber: jest.fn().mockResolvedValue("REG-2026-00001") };
  const usersService = { create: jest.fn() };
  const storage = { remove: jest.fn().mockResolvedValue(undefined) };
  const integrations = { isEnabled: jest.fn().mockResolvedValue(false) };
  const service = new MembersService(
    prisma as never,
    aadhaar as never,
    numbering as never,
    usersService as never,
    storage as never,
    integrations as never,
  );
  return { service, aadhaar, numbering, usersService, storage, integrations };
}

describe("MembersService.create", () => {
  it("generates a registration number and persists field-executive capture metadata", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.create.mockResolvedValue(makeMember({ registrationNumber: "REG-2026-00001" }));

    const result = await service.create(
      {
        fullName: "Test Member",
        mobile: "9800000000",
        registrationLatitude: 23.35,
        registrationLongitude: 85.33,
        deviceId: "device-1",
        registrationMode: "ONLINE",
      },
      makeAuthUser({ id: "fe-1" }),
    );

    expect(result.registrationNumber).toBe("REG-2026-00001");
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdById: "fe-1",
        registrationNumber: "REG-2026-00001",
        registrationLatitude: 23.35,
        registrationLongitude: 85.33,
        deviceId: "device-1",
        registrationMode: "ONLINE",
      }),
    });
  });
});

describe("MembersService.update", () => {
  it("blocks changing the plan once the registration fee is collected", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(
      makeMember({ status: "PAYMENT_COLLECTED", createdById: "fe-1", planId: "plan-a" }),
    );

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { planId: "plan-b" }, user)).rejects.toThrow(ConflictException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("blocks changing the fee override once the registration fee is collected", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(
      makeMember({ status: "PAYMENT_COLLECTED", createdById: "fe-1", feeOverride: decimal(500) }),
    );

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { feeOverride: 750 }, user)).rejects.toThrow(ConflictException);
  });

  it("allows re-sending the same plan/fee after PAYMENT_COLLECTED (no-op change is not a change)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "PAYMENT_COLLECTED", createdById: "fe-1", planId: "plan-a" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.membershipPlan.findFirst.mockResolvedValue({ id: "plan-a" });
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.update("member-1", { planId: "plan-a" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("treats an unset fee override (null) sent as null again as a no-op, not a change", async () => {
    // Regression: the member wizard PATCHes the whole form on every step,
    // so `feeOverride` is always present in the DTO (as null when the field
    // was never touched) — comparing that against existing.feeOverride
    // (undefined via Decimal?.toNumber() when null) must not treat
    // null !== undefined as a real change, or nobody without an explicit
    // fee override could ever get past the Payment step of the wizard.
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "PAYMENT_COLLECTED", createdById: "fe-1", feeOverride: null });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.update("member-1", { feeOverride: null, declarationInfoCorrect: true }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("allows other fields to be edited after PAYMENT_COLLECTED (documents/declaration steps)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "PAYMENT_COLLECTED", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.update("member-1", { declarationInfoCorrect: true }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("a FIELD_EXECUTIVE cannot edit a SUBMITTED member created by someone else", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "SUBMITTED", createdById: "someone-else" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { fullName: "New Name" }, user)).rejects.toThrow(NotFoundException);
  });

  it("a FIELD_EXECUTIVE cannot edit another field executive's draft (404, not 403 — no existence leak)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT", createdById: "someone-else" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { fullName: "New Name" }, user)).rejects.toThrow(NotFoundException);
  });

  it("an ADMIN can edit any draft regardless of who created it", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "DRAFT", createdById: "someone-else" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await service.update("member-1", { fullName: "New Name" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("an ADMIN can correct an ACTIVE member's profile", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "ACTIVE", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await service.update("member-1", { mobile: "9800000099" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("a SUPER_ADMIN can correct a SUSPENDED member's profile", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "SUSPENDED", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "super-1", role: Role.SUPER_ADMIN });
    await service.update("member-1", { addressLine: "New address" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("an ADMIN can correct an EXPIRED member's profile", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "EXPIRED", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await service.update("member-1", { addressLine: "New address" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("an ADMIN can correct a RENEWED member's profile", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "RENEWED", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await service.update("member-1", { addressLine: "New address" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("an ADMIN can correct a SUBMITTED member's profile (e.g. a typo spotted mid-review)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "SUBMITTED", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await service.update("member-1", { addressLine: "New address" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("an ADMIN can correct an APPROVED member's profile", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "APPROVED", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await service.update("member-1", { addressLine: "New address" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("a FIELD_EXECUTIVE can edit a SUBMITTED member they created", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "SUBMITTED", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.update("member-1", { fullName: "New Name" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("a FIELD_EXECUTIVE can edit an ACTIVE member they created", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = makeMember({ status: "ACTIVE", createdById: "fe-1" });
    prisma.member.findFirst.mockResolvedValue(existing);
    prisma.member.findUniqueOrThrow.mockResolvedValue(existing);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.update("member-1", { fullName: "New Name" }, user);
    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("a FIELD_EXECUTIVE still cannot edit an ACTIVE member created by someone else — ownership is unaffected by the staff-only-status widening", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "ACTIVE", createdById: "fe-2" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { fullName: "New Name" }, user)).rejects.toThrow(NotFoundException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("blocks an admin from changing the plan or fee on an ACTIVE member", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(
      makeMember({ status: "ACTIVE", createdById: "fe-1", planId: "plan-a" }),
    );

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await expect(service.update("member-1", { planId: "plan-b" }, user)).rejects.toThrow(ConflictException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("rejects setting the member themselves as their own referrer (self-referral)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ id: "member-1", status: "DRAFT", createdById: "fe-1" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { referralMemberId: "member-1" }, user)).rejects.toThrow(ConflictException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("rejects a referrer from another organization (cross-org FK)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst
      .mockResolvedValueOnce(makeMember({ id: "member-1", status: "DRAFT", createdById: "fe-1" }))
      .mockResolvedValueOnce(null); // referrer lookup scoped to org-1 finds nothing

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { referralMemberId: "other-org-member" }, user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejects a referral chain that would loop back to the member being edited", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    // findEditable reads member-1, then assertReferrerValid reads the
    // candidate referrer A whose own referrer is member-1 → forming a loop.
    prisma.member.findFirst
      .mockResolvedValueOnce(makeMember({ id: "member-1", status: "DRAFT", createdById: "fe-1" }))
      .mockResolvedValueOnce(makeMember({ id: "referrer-a", referralMemberId: "member-1" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { referralMemberId: "referrer-a" }, user)).rejects.toThrow(ConflictException);
  });
});

describe("MembersService.submit", () => {
  const completeDraft = makeMember({
    status: "DRAFT",
    createdById: "fe-1",
    fullName: "Test Member",
    mobile: "9800000000",
    planId: "plan-1",
    addressLine: "123 Main St",
    pincode: "834001",
    declarationInfoCorrect: true,
    declarationAcceptConstitution: true,
    declarationAcceptPrivacyPolicy: true,
    declarationAcceptTerms: true,
  });

  it("submits a DRAFT member with all required fields present — moves to AWAITING_PAYMENT", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(completeDraft);
    prisma.memberDocument.findFirst.mockResolvedValue({ id: "doc-1" });
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.member.findUniqueOrThrow.mockResolvedValue({ ...completeDraft, status: "AWAITING_PAYMENT" });

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    const result = await service.submit("member-1", user);

    expect(result.status).toBe("AWAITING_PAYMENT");
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "DRAFT", toStatus: "AWAITING_PAYMENT", actorId: "fe-1" },
    });
  });

  it.each(["AWAITING_PAYMENT", "PAYMENT_COLLECTED", "SUBMITTED"])(
    "refuses to submit a %s member — only DRAFT can be submitted (payment now comes after)",
    async (status) => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ status, createdById: "fe-1" }));

      const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
      await expect(service.submit("member-1", user)).rejects.toThrow(ConflictException);
      expect(prisma.member.updateMany).not.toHaveBeenCalled();
    },
  );

  it("refuses to submit when required fields are missing", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(
      makeMember({ status: "DRAFT", createdById: "fe-1", planId: null }),
    );

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.submit("member-1", user)).rejects.toThrow(/missing/i);
  });

  it("refuses to submit without a passport photo and an ID proof document on file", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(completeDraft);
    prisma.memberDocument.findFirst.mockResolvedValue(null); // neither photo nor ID proof uploaded

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.submit("member-1", user)).rejects.toThrow(/photo|ID proof/i);
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });

  it("loses a concurrent double-submit race cleanly via the CAS guard", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(completeDraft);
    prisma.memberDocument.findFirst.mockResolvedValue({ id: "doc-1" });
    prisma.member.updateMany.mockResolvedValue({ count: 0 });

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.submit("member-1", user)).rejects.toThrow(ConflictException);
    expect(prisma.statusHistory.create).not.toHaveBeenCalled();
  });
});

describe("MembersService.claim", () => {
  it("reassigns createdById to the claiming field executive for an unclaimed self-registration", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const unclaimed = { ...makeMember({ selfRegistered: true }), createdBy: { isSystem: true } };
    prisma.member.findFirst.mockResolvedValue(unclaimed);
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ selfRegistered: true, createdById: "fe-1" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.claim("member-1", user);

    expect(prisma.member.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "member-1", selfRegistered: true, createdBy: { isSystem: true } },
        data: { createdById: "fe-1" },
      }),
    );
  });

  it("loses a concurrent double-claim race cleanly via the CAS guard", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const unclaimed = { ...makeMember({ selfRegistered: true }), createdBy: { isSystem: true } };
    prisma.member.findFirst.mockResolvedValue(unclaimed);
    prisma.member.updateMany.mockResolvedValue({ count: 0 });

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.claim("member-1", user)).rejects.toThrow(ConflictException);
  });

  it("refuses to claim a member that was staff-created (not self-registered)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const staffCreated = { ...makeMember({ selfRegistered: false }), createdBy: { isSystem: false } };
    prisma.member.findFirst.mockResolvedValue(staffCreated);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.claim("member-1", user)).rejects.toThrow(ConflictException);
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to claim a self-registration someone else already claimed", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const alreadyClaimed = {
      ...makeMember({ selfRegistered: true, createdById: "fe-2" }),
      createdBy: { isSystem: false },
    };
    prisma.member.findFirst.mockResolvedValue(alreadyClaimed);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.claim("member-1", user)).rejects.toThrow(ConflictException);
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });
});

describe("MembersService.promoteToExecutive", () => {
  it("creates a FIELD_EXECUTIVE user and links it back to the member", async () => {
    const prisma = makeMockPrisma();
    const { service, usersService } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "ACTIVE", promotedToUserId: null }));
    usersService.create.mockResolvedValue({ id: "new-user-1", email: "promo@example.com", role: Role.FIELD_EXECUTIVE });
    prisma.member.updateMany.mockResolvedValue({ count: 1 });

    const admin = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    const result = await service.promoteToExecutive(
      "member-1",
      { email: "promo@example.com", password: "Passw0rd!" },
      admin,
    );

    expect(result.id).toBe("new-user-1");
    expect(usersService.create).toHaveBeenCalledWith(
      { email: "promo@example.com", password: "Passw0rd!", role: Role.FIELD_EXECUTIVE },
      admin,
    );
    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: "member-1", status: "ACTIVE", promotedToUserId: null },
      data: { promotedToUserId: "new-user-1" },
    });
  });

  it("loses a concurrent double-promote race cleanly and cleans up the orphaned user", async () => {
    const prisma = makeMockPrisma();
    const { service, usersService } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "ACTIVE", promotedToUserId: null }));
    usersService.create.mockResolvedValue({ id: "new-user-1", email: "promo@example.com", role: Role.FIELD_EXECUTIVE });
    prisma.member.updateMany.mockResolvedValue({ count: 0 });

    const admin = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await expect(
      service.promoteToExecutive("member-1", { email: "promo@example.com", password: "Passw0rd!" }, admin),
    ).rejects.toThrow(ConflictException);
    expect(usersService.create).toHaveBeenCalledTimes(1);
  });

  it("refuses to promote a member that isn't ACTIVE", async () => {
    const prisma = makeMockPrisma();
    const { service, usersService } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT" }));

    const admin = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await expect(
      service.promoteToExecutive("member-1", { email: "promo@example.com", password: "Passw0rd!" }, admin),
    ).rejects.toThrow(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it("refuses to promote a member that's already been promoted", async () => {
    const prisma = makeMockPrisma();
    const { service, usersService } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "ACTIVE", promotedToUserId: "existing-user" }));

    const admin = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await expect(
      service.promoteToExecutive("member-1", { email: "promo@example.com", password: "Passw0rd!" }, admin),
    ).rejects.toThrow(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });
});

describe("MembersService.dedupeCheck", () => {
  it("matches on exact mobile regardless of the AI_DEDUPE flag", async () => {
    const prisma = makeMockPrisma();
    const { service, integrations } = makeService(prisma);
    prisma.member.findMany.mockResolvedValue([
      makeMember({ id: "member-1", fullName: "Ramesh Kumar", status: "ACTIVE", mobile: "9800000000" }),
    ]);

    const matches = await service.dedupeCheck("9800000000", undefined, undefined, "org-1");

    expect(matches).toEqual([{ id: "member-1", fullName: "Ramesh Kumar", status: "ACTIVE", matchedOn: "mobile" }]);
    expect(integrations.isEnabled).not.toHaveBeenCalled();
  });

  it("skips the fuzzy name pass entirely when AI_DEDUPE is disabled", async () => {
    const prisma = makeMockPrisma();
    const { service, integrations } = makeService(prisma);
    integrations.isEnabled.mockResolvedValue(false);

    const matches = await service.dedupeCheck(undefined, undefined, "Ramesh Kumar", "org-1");

    expect(matches).toEqual([]);
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it("finds a near-duplicate name when AI_DEDUPE is enabled", async () => {
    const prisma = makeMockPrisma();
    const { service, integrations } = makeService(prisma);
    integrations.isEnabled.mockResolvedValue(true);
    prisma.member.findMany.mockResolvedValue([
      { id: "member-1", fullName: "Ramesh Kumar", status: "ACTIVE" },
      { id: "member-2", fullName: "Totally Different Name", status: "ACTIVE" },
    ]);

    const matches = await service.dedupeCheck(undefined, undefined, "Ramesh Kumer", "org-1");

    expect(matches).toEqual([{ id: "member-1", fullName: "Ramesh Kumar", status: "ACTIVE", matchedOn: "name" }]);
  });

  it("doesn't double-report a member already matched by mobile in the fuzzy pass", async () => {
    const prisma = makeMockPrisma();
    const { service, integrations } = makeService(prisma);
    integrations.isEnabled.mockResolvedValue(true);
    prisma.member.findMany
      .mockResolvedValueOnce([
        makeMember({ id: "member-1", fullName: "Ramesh Kumar", status: "ACTIVE", mobile: "9800000000" }),
      ])
      .mockResolvedValueOnce([{ id: "member-1", fullName: "Ramesh Kumar", status: "ACTIVE" }]);

    const matches = await service.dedupeCheck("9800000000", undefined, "Ramesh Kumar", "org-1");

    expect(matches).toEqual([{ id: "member-1", fullName: "Ramesh Kumar", status: "ACTIVE", matchedOn: "mobile" }]);
  });
});

describe("MembersService.getMe", () => {
  it("returns the member's own record with no jurisdiction or role scoping", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ id: "member-1", fullName: "Self Member" }));

    const result = await service.getMe("member-1");

    expect(prisma.member.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "member-1" } }),
    );
    expect(result.fullName).toBe("Self Member");
  });
});

describe("MembersService.updateMe", () => {
  it("only writes the curated self-editable field set", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.update.mockResolvedValue(makeMember({ id: "member-1", fullName: "Updated Name" }));

    const result = await service.updateMe("member-1", { fullName: "Updated Name", whatsappNumber: "9811111111" });

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { fullName: "Updated Name", whatsappNumber: "9811111111" },
      include: expect.anything(),
    });
    expect(result.fullName).toBe("Updated Name");
  });
});

describe("MembersService.resetPassword", () => {
  it("lets an ADMIN reset any member's password, hashed", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ id: "member-1", status: "ACTIVE", createdById: "fe-1" }));

    const user = makeAuthUser({ id: "admin-1", role: Role.ADMIN });
    await service.resetPassword("member-1", "NewPassw0rd!", user);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { passwordHash: expect.any(String) },
    });
    const written = prisma.member.update.mock.calls[0][0].data.passwordHash;
    expect(written).not.toBe("NewPassw0rd!");
  });

  it("lets a FIELD_EXECUTIVE reset the password of an ACTIVE member they created", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ id: "member-1", status: "ACTIVE", createdById: "fe-1" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.resetPassword("member-1", "NewPassw0rd!", user);

    expect(prisma.member.update).toHaveBeenCalled();
  });

  it("blocks a FIELD_EXECUTIVE from resetting the password of a member they didn't create", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ id: "member-1", status: "ACTIVE", createdById: "fe-2" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.resetPassword("member-1", "NewPassw0rd!", user)).rejects.toThrow(NotFoundException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});
