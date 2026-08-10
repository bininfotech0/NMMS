import { ConflictException, NotFoundException } from "@nestjs/common";
import { Role } from "@nmms/shared";
import { MembersService } from "./members.service";
import { decimal, makeAuthUser, makeMember, makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  const aadhaar = { hash: jest.fn((v: string) => `hashed:${v}`), last4: jest.fn((v: string) => v.slice(-4)) };
  const numbering = { nextRegistrationNumber: jest.fn().mockResolvedValue("REG-2026-00001") };
  const usersService = { create: jest.fn() };
  const storage = { remove: jest.fn().mockResolvedValue(undefined) };
  const service = new MembersService(
    prisma as never,
    aadhaar as never,
    numbering as never,
    usersService as never,
    storage as never,
  );
  return { service, aadhaar, numbering, usersService, storage };
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

  it("refuses to edit a member that's already been submitted", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "SUBMITTED", createdById: "fe-1" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.update("member-1", { fullName: "New Name" }, user)).rejects.toThrow(ConflictException);
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
});

describe("MembersService.submit", () => {
  const completeDraft = makeMember({
    status: "PAYMENT_COLLECTED",
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

  it("submits a PAYMENT_COLLECTED member with all required fields present", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(completeDraft);
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.member.findUniqueOrThrow.mockResolvedValue({ ...completeDraft, status: "SUBMITTED" });

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    const result = await service.submit("member-1", user);

    expect(result.status).toBe("SUBMITTED");
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "PAYMENT_COLLECTED", toStatus: "SUBMITTED", actorId: "fe-1" },
    });
  });

  it("refuses to submit a DRAFT member — payment must be collected first", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT", createdById: "fe-1" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.submit("member-1", user)).rejects.toThrow(ConflictException);
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to submit when required fields are missing", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(
      makeMember({ status: "PAYMENT_COLLECTED", createdById: "fe-1", planId: null }),
    );

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.submit("member-1", user)).rejects.toThrow(/missing/i);
  });

  it("loses a concurrent double-submit race cleanly via the CAS guard", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(completeDraft);
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
    prisma.member.update.mockResolvedValue(makeMember({ selfRegistered: true, createdById: "fe-1" }));

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await service.claim("member-1", user);

    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "member-1" }, data: { createdById: "fe-1" } }),
    );
  });

  it("refuses to claim a member that was staff-created (not self-registered)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const staffCreated = { ...makeMember({ selfRegistered: false }), createdBy: { isSystem: false } };
    prisma.member.findFirst.mockResolvedValue(staffCreated);

    const user = makeAuthUser({ id: "fe-1", role: Role.FIELD_EXECUTIVE });
    await expect(service.claim("member-1", user)).rejects.toThrow(ConflictException);
    expect(prisma.member.update).not.toHaveBeenCalled();
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
    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});

describe("MembersService.promoteToExecutive", () => {
  it("creates a FIELD_EXECUTIVE user and links it back to the member", async () => {
    const prisma = makeMockPrisma();
    const { service, usersService } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "ACTIVE", promotedToUserId: null }));
    usersService.create.mockResolvedValue({ id: "new-user-1", email: "promo@example.com", role: Role.FIELD_EXECUTIVE });

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
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { promotedToUserId: "new-user-1" },
    });
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
