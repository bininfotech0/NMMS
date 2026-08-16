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
});
