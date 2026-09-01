import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Role } from "@nmms/shared";
import { ApplicationsService } from "./applications.service";
import { makeAuthUser, makeMember, makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  const numbering = { nextMembershipNumber: jest.fn().mockResolvedValue("MEM-2026-00001") };
  const membersService = { findOne: jest.fn() };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const referrals = {
    awardPointsForApproval: jest.fn().mockResolvedValue(undefined),
    awardBatchRewardForTier: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ApplicationsService(
    prisma as never,
    numbering as never,
    membersService as never,
    notifications as never,
    referrals as never,
  );
  return { service, numbering, membersService, notifications, referrals };
}

describe("ApplicationsService", () => {
  describe("approve", () => {
    it("assigns a membership number and jumps straight to ACTIVE (no lingering APPROVED state)", async () => {
      const prisma = makeMockPrisma();
      const { service, notifications } = makeService(prisma);
      const submittedMember = makeMember({ status: "SUBMITTED", plan: { validityType: "MONTHS", validityMonths: 12 } });
      prisma.member.findFirst.mockResolvedValue(submittedMember);
      prisma.member.updateMany.mockResolvedValue({ count: 1 });
      prisma.member.findUniqueOrThrow.mockResolvedValue({ ...submittedMember, status: "ACTIVE", membershipNumber: "MEM-2026-00001" });

      const user = makeAuthUser({ role: Role.ADMIN });
      const result = await service.approve("member-1", user);

      expect(result.status).toBe("ACTIVE");
      expect(result.membershipNumber).toBe("MEM-2026-00001");
      // A single StatusHistory row straight to ACTIVE — activateMemberOnce
      // (shared with PaymentsService's auto-activation branch) no longer
      // records a transient APPROVED hop.
      expect(prisma.statusHistory.create).toHaveBeenCalledTimes(1);
      expect(prisma.statusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: "SUBMITTED", toStatus: "ACTIVE" }),
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "APPROVAL_WELCOME" }),
      );
    });

    it("rejects approval of a member that doesn't exist (or isn't SUBMITTED)", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(null);

      const user = makeAuthUser({ role: Role.ADMIN });
      await expect(service.approve("member-1", user)).rejects.toThrow(ConflictException);
    });

    it("rejects a FIELD_EXECUTIVE — approval is not their permission even for their own member", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const submittedMember = makeMember({ status: "SUBMITTED", createdById: "fe-1", plan: null });
      prisma.member.findFirst.mockResolvedValue(submittedMember);

      const user = makeAuthUser({ role: Role.FIELD_EXECUTIVE, id: "fe-1" });
      await expect(service.approve("member-1", user)).rejects.toThrow(ForbiddenException);
      // Role check must fail before any mutation is attempted.
      expect(prisma.member.updateMany).not.toHaveBeenCalled();
    });

    it("allows a FIELD_EXECUTIVE to approve a self-registered member they claimed", async () => {
      const prisma = makeMockPrisma();
      const { service, notifications } = makeService(prisma);
      const submittedMember = makeMember({
        status: "SUBMITTED",
        createdById: "fe-1",
        selfRegistered: true,
        plan: null,
      });
      prisma.member.findFirst.mockResolvedValue(submittedMember);
      prisma.member.updateMany.mockResolvedValue({ count: 1 });
      prisma.member.findUniqueOrThrow.mockResolvedValue({ ...submittedMember, status: "ACTIVE" });

      const user = makeAuthUser({ role: Role.FIELD_EXECUTIVE, id: "fe-1" });
      const result = await service.approve("member-1", user);

      expect(result.status).toBe("ACTIVE");
      expect(notifications.notify).toHaveBeenCalled();
    });

    it("still rejects a FIELD_EXECUTIVE for a member they created directly (not self-registered)", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const submittedMember = makeMember({
        status: "SUBMITTED",
        createdById: "fe-1",
        selfRegistered: false,
        plan: null,
      });
      prisma.member.findFirst.mockResolvedValue(submittedMember);

      const user = makeAuthUser({ role: Role.FIELD_EXECUTIVE, id: "fe-1" });
      await expect(service.approve("member-1", user)).rejects.toThrow(ForbiddenException);
      expect(prisma.member.updateMany).not.toHaveBeenCalled();
    });

    it("loses a concurrent double-approve race cleanly via the CAS guard", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const submittedMember = makeMember({ status: "SUBMITTED", plan: null });
      prisma.member.findFirst.mockResolvedValue(submittedMember);
      // Someone else's request already flipped the status — 0 rows matched.
      prisma.member.updateMany.mockResolvedValue({ count: 0 });

      const user = makeAuthUser({ role: Role.SUPER_ADMIN });
      await expect(service.approve("member-1", user)).rejects.toThrow(ConflictException);
      expect(prisma.statusHistory.create).not.toHaveBeenCalled();
    });
  });

  describe("reject", () => {
    it("rejects a SUBMITTED member with remarks", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const submittedMember = makeMember({ status: "SUBMITTED" });
      prisma.member.findFirst.mockResolvedValue(submittedMember);
      prisma.member.updateMany.mockResolvedValue({ count: 1 });
      prisma.member.findUniqueOrThrow.mockResolvedValue({ ...submittedMember, status: "REJECTED" });

      const user = makeAuthUser({ role: Role.ADMIN });
      const result = await service.reject("member-1", { remarks: "Incomplete documents" }, user);

      expect(result.status).toBe("REJECTED");
      expect(prisma.member.updateMany).toHaveBeenCalledWith({
        where: { id: "member-1", status: "SUBMITTED" },
        data: { status: "REJECTED" },
      });
      expect(prisma.statusHistory.create).toHaveBeenCalledWith({
        data: { memberId: "member-1", fromStatus: "SUBMITTED", toStatus: "REJECTED", actorId: user.id, remarks: "Incomplete documents" },
      });
    });

    it("refuses to reject a member that isn't SUBMITTED", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ status: "ACTIVE" }));

      const user = makeAuthUser({ role: Role.ADMIN });
      await expect(service.reject("member-1", { remarks: "test" }, user)).rejects.toThrow(ConflictException);
    });
  });

  describe("lifecycle actions", () => {
    it("suspends an ACTIVE member", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const active = makeMember({ status: "ACTIVE" });
      prisma.member.findFirst.mockResolvedValue(active);
      prisma.member.updateMany.mockResolvedValue({ count: 1 });
      prisma.member.findUniqueOrThrow.mockResolvedValue({ ...active, status: "SUSPENDED" });

      const user = makeAuthUser({ role: Role.ADMIN });
      const result = await service.suspend("member-1", { remarks: "Fraud investigation" }, user);

      expect(result.status).toBe("SUSPENDED");
      expect(prisma.member.updateMany).toHaveBeenCalledWith({
        where: { id: "member-1", status: "ACTIVE" },
        data: { status: "SUSPENDED" },
      });
      expect(prisma.statusHistory.create).toHaveBeenCalledWith({
        data: { memberId: "member-1", fromStatus: "ACTIVE", toStatus: "SUSPENDED", actorId: user.id, remarks: "Fraud investigation" },
      });
    });

    it("refuses to suspend a member that isn't currently ACTIVE", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(null); // DRAFT member doesn't match the ACTIVE filter

      const user = makeAuthUser({ role: Role.ADMIN });
      await expect(service.suspend("member-1", { remarks: "test" }, user)).rejects.toThrow(ConflictException);
    });

    it("reactivates a SUSPENDED member", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const suspended = makeMember({ status: "SUSPENDED" });
      prisma.member.findFirst.mockResolvedValue(suspended);
      prisma.member.updateMany.mockResolvedValue({ count: 1 });
      prisma.member.findUniqueOrThrow.mockResolvedValue({ ...suspended, status: "ACTIVE" });

      const user = makeAuthUser({ role: Role.ADMIN });
      const result = await service.reactivate("member-1", { remarks: "Cleared" }, user);
      expect(result.status).toBe("ACTIVE");
    });

    it("marks an ACTIVE member deceased", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const active = makeMember({ status: "ACTIVE" });
      prisma.member.findFirst.mockResolvedValue(active);
      prisma.member.updateMany.mockResolvedValue({ count: 1 });
      prisma.member.findUniqueOrThrow.mockResolvedValue({ ...active, status: "DECEASED" });

      const user = makeAuthUser({ role: Role.SUPER_ADMIN });
      const result = await service.markDeceased("member-1", { remarks: "Confirmed by family" }, user);
      expect(result.status).toBe("DECEASED");
    });

    it("marks a SUSPENDED member deceased too", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const suspended = makeMember({ status: "SUSPENDED" });
      prisma.member.findFirst.mockResolvedValue(suspended);
      prisma.member.updateMany.mockResolvedValue({ count: 1 });
      prisma.member.findUniqueOrThrow.mockResolvedValue({ ...suspended, status: "DECEASED" });

      const user = makeAuthUser({ role: Role.SUPER_ADMIN });
      const result = await service.markDeceased("member-1", { remarks: "test" }, user);
      expect(result.status).toBe("DECEASED");
    });

    it("blocks lifecycle actions for FIELD_EXECUTIVE", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const user = makeAuthUser({ role: Role.FIELD_EXECUTIVE });
      await expect(service.suspend("member-1", { remarks: "test" }, user)).rejects.toThrow(ForbiddenException);
      expect(prisma.member.findFirst).not.toHaveBeenCalled();
    });
  });
});
