import { ReportsService } from "./reports.service";
import { decimal, makeAuthUser, makeMockPrisma } from "../test/fixtures";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

describe("ReportsService.summary", () => {
  it("returns a real 12-month collections series bucketed from payments, not an evenly-divided total", async () => {
    const prisma = makeMockPrisma();
    const service = new ReportsService(prisma as never);

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    prisma.member.findMany.mockResolvedValue([]);
    prisma.membershipPlan.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([
      { amount: decimal(300), paidAt: now, memberId: "m1" },
      { amount: decimal(200), paidAt: now, memberId: "m1" },
      { amount: decimal(150), paidAt: lastMonth, memberId: "m2" },
    ]);
    prisma.statusHistory.findMany.mockResolvedValue([]);
    prisma.member.count.mockResolvedValue(0);

    const result = await service.summary(makeAuthUser());

    expect(result.monthlyCollections).toHaveLength(12);
    const thisMonthEntry = result.monthlyCollections?.find((e) => e.month === monthKey(now));
    const lastMonthEntry = result.monthlyCollections?.find((e) => e.month === monthKey(lastMonth));
    expect(thisMonthEntry?.amount).toBe(500);
    expect(lastMonthEntry?.amount).toBe(150);

    // Confirms this isn't the old "this month's total divided by 12" bug —
    // real months have genuinely different totals.
    const distinctAmounts = new Set(result.monthlyCollections?.map((e) => e.amount));
    expect(distinctAmounts.size).toBeGreaterThan(1);

    // Still exposes the pre-existing scalar fields unchanged.
    expect(result.totalCollected).toBe(650);
    expect(result.thisMonthCollected).toBe(500);
  });

  it("counts expiringThisMonth against true calendar-month bounds, not a rolling 30-day window", async () => {
    const prisma = makeMockPrisma();
    const service = new ReportsService(prisma as never);

    prisma.member.findMany.mockResolvedValue([]);
    prisma.membershipPlan.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.statusHistory.findMany.mockResolvedValue([]);
    prisma.member.count.mockResolvedValue(3);

    const before = new Date();
    const result = await service.summary(makeAuthUser());
    const after = new Date();

    expect(result.expiringThisMonth).toBe(3);
    const callArgs = prisma.member.count.mock.calls[0][0];
    const { gte, lte } = callArgs.where.validUntil;

    // gte must be "now" (not before the call started, not after it finished).
    expect(gte.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(gte.getTime()).toBeLessThanOrEqual(after.getTime());

    // lte must be the last instant of the current calendar month, not
    // now + 30 days (which would land in the following month for most days).
    expect(lte.getFullYear()).toBe(before.getFullYear());
    expect(lte.getMonth()).toBe(before.getMonth());
    const lastDayOfMonth = new Date(before.getFullYear(), before.getMonth() + 1, 0).getDate();
    expect(lte.getDate()).toBe(lastDayOfMonth);
  });
});
