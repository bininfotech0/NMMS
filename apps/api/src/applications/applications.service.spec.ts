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
