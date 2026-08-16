import { MemberExpiryScheduler } from "./member-expiry.scheduler";
import { makeMockPrisma } from "../test/fixtures";

function makeMemberAuth(overrides: Record<string, jest.Mock> = {}) {
  return {
    getOrCreateSystemUser: jest.fn().mockResolvedValue("system-user-1"),
    ...overrides,
  };
}

describe("MemberExpiryScheduler.expireOverdueMembers", () => {
  it("does nothing when there are no overdue members", async () => {
    const prisma = makeMockPrisma();
    const memberAuth = makeMemberAuth();
    const scheduler = new MemberExpiryScheduler(prisma as never, memberAuth as never);
    prisma.member.findMany.mockResolvedValue([]);

    await scheduler.expireOverdueMembers();

    expect(prisma.member.updateMany).not.toHaveBeenCalled();
    expect(prisma.statusHistory.create).not.toHaveBeenCalled();
  });

  it("CAS-transitions each overdue ACTIVE member to EXPIRED and records StatusHistory", async () => {
    const prisma = makeMockPrisma();
    const memberAuth = makeMemberAuth();
    const scheduler = new MemberExpiryScheduler(prisma as never, memberAuth as never);
    prisma.member.findMany.mockResolvedValue([{ id: "member-1", organizationId: "org-1" }]);
    prisma.member.updateMany.mockResolvedValue({ count: 1 });

    await scheduler.expireOverdueMembers();

    expect(memberAuth.getOrCreateSystemUser).toHaveBeenCalledWith("org-1");
    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: "member-1", status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "ACTIVE", toStatus: "EXPIRED", actorId: "system-user-1" },
    });
  });

  it("skips a member that already transitioned off ACTIVE since the query (e.g. a renewal race)", async () => {
    const prisma = makeMockPrisma();
    const memberAuth = makeMemberAuth();
    const scheduler = new MemberExpiryScheduler(prisma as never, memberAuth as never);
    prisma.member.findMany.mockResolvedValue([{ id: "member-1", organizationId: "org-1" }]);
    prisma.member.updateMany.mockResolvedValue({ count: 0 });

    await scheduler.expireOverdueMembers();

    expect(prisma.statusHistory.create).not.toHaveBeenCalled();
  });
});
