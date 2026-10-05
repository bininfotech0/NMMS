import { MemberExpiryScheduler, istDayStart } from "./member-expiry.scheduler";
import { makeMockPrisma } from "../test/fixtures";

function makeMemberAuth(overrides: Record<string, jest.Mock> = {}) {
  return {
    getOrCreateSystemUser: jest.fn().mockResolvedValue("system-user-1"),
    ...overrides,
  };
}

function makeNotifications() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

describe("MemberExpiryScheduler.expireOverdueMembers", () => {
  it("does nothing when there are no overdue members", async () => {
    const prisma = makeMockPrisma();
    const memberAuth = makeMemberAuth();
    const scheduler = new MemberExpiryScheduler(prisma as never, memberAuth as never, makeNotifications() as never);
    prisma.member.findMany.mockResolvedValue([]);

    await scheduler.expireOverdueMembers();

    expect(prisma.member.updateMany).not.toHaveBeenCalled();
    expect(prisma.statusHistory.create).not.toHaveBeenCalled();
  });

  it("CAS-transitions each overdue ACTIVE member to EXPIRED and records StatusHistory", async () => {
    const prisma = makeMockPrisma();
    const memberAuth = makeMemberAuth();
    const scheduler = new MemberExpiryScheduler(prisma as never, memberAuth as never, makeNotifications() as never);
    prisma.member.findMany.mockResolvedValue([
      { id: "member-1", organizationId: "org-1", fullName: "Asha", mobile: "9876543210", email: null },
    ]);
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
    const scheduler = new MemberExpiryScheduler(prisma as never, memberAuth as never, makeNotifications() as never);
    prisma.member.findMany.mockResolvedValue([{ id: "member-1", organizationId: "org-1" }]);
    prisma.member.updateMany.mockResolvedValue({ count: 0 });

    await scheduler.expireOverdueMembers();

    expect(prisma.statusHistory.create).not.toHaveBeenCalled();
  });
});

describe("MemberExpiryScheduler notifications", () => {
  it("tells a member their membership has ended, only when the CAS succeeded", async () => {
    const prisma = makeMockPrisma();
    const notifications = makeNotifications();
    const scheduler = new MemberExpiryScheduler(prisma as never, makeMemberAuth() as never, notifications as never);
    prisma.member.findMany.mockResolvedValue([
      { id: "member-1", organizationId: "org-1", fullName: "Asha", mobile: "9876543210", email: null },
      { id: "member-2", organizationId: "org-1", fullName: "Ravi", mobile: "9876500000", email: null },
    ]);
    prisma.member.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await scheduler.expireOverdueMembers();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "MEMBERSHIP_EXPIRED", memberName: "Asha", mobile: "9876543210" }),
    );
  });

  it("sends 30/7/1-day reminders for members whose end date falls on that India-time day", async () => {
    const prisma = makeMockPrisma();
    const notifications = makeNotifications();
    const scheduler = new MemberExpiryScheduler(prisma as never, makeMemberAuth() as never, notifications as never);
    const validUntil = new Date("2026-10-12T06:00:00.000Z");
    prisma.member.findMany
      .mockResolvedValueOnce([]) // 30 days
      .mockResolvedValueOnce([{ organizationId: "org-1", fullName: "Asha", mobile: "9876543210", email: null, validUntil }]) // 7 days
      .mockResolvedValueOnce([]); // 1 day

    const now = new Date("2026-10-05T04:30:00.000Z"); // 10:00 IST
    await scheduler.sendExpiryReminders(now);

    expect(prisma.member.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.member.findMany.mock.calls[1][0].where).toEqual({
      status: "ACTIVE",
      validUntil: { gte: istDayStart(now, 7), lt: istDayStart(now, 8) },
    });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "MEMBERSHIP_EXPIRING", daysLeft: 7, validUntil }),
    );
  });
});

describe("istDayStart", () => {
  it("returns India-time midnight as UTC, even late at night UTC", () => {
    // 2026-10-05 20:00 UTC is already 2026-10-06 01:30 in India.
    expect(istDayStart(new Date("2026-10-05T20:00:00.000Z"), 0).toISOString()).toBe("2026-10-05T18:30:00.000Z");
    expect(istDayStart(new Date("2026-10-05T04:30:00.000Z"), 1).toISOString()).toBe("2026-10-05T18:30:00.000Z");
  });
});
