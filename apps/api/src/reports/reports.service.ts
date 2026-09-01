import { Injectable } from "@nestjs/common";
import type { MemberStatus } from "@prisma/client";
import type {
  AuthUser,
  FieldExecutivePerformanceRow,
  MemberRegisterRow,
  MonthlyAmount,
  NamedCount,
  PaymentCollectionRow,
  RenewalRow,
  ReportsSummaryResponse,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { buildJurisdictionWhere } from "../common/scope.util";

const MONTHS_BACK = 12;
// AWAITING_PAYMENT is the standard pre-activation state since the
// form-first/payment-last redesign; SUBMITTED/VERIFIED/APPROVED are legacy
// (pre-redesign) statuses that may still have historical counts.
const APPLICATION_FUNNEL_STATUSES = ["AWAITING_PAYMENT", "SUBMITTED", "VERIFIED", "APPROVED", "REJECTED"];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthUser): Promise<ReportsSummaryResponse> {
    const organizationId = user.organizationId;
    const scope = buildJurisdictionWhere(user);
    const monthKeys = lastNMonthKeys(MONTHS_BACK);
    const earliestMonth = new Date();
    earliestMonth.setMonth(earliestMonth.getMonth() - (MONTHS_BACK - 1));
    earliestMonth.setDate(1);
    earliestMonth.setHours(0, 0, 0, 0);

    const [members, plans, payments, recentSh] = await Promise.all([
      this.prisma.member.findMany({
        where: { organizationId, ...scope },
        select: { status: true, createdAt: true, planId: true, id: true, fullName: true },
      }),
      this.prisma.membershipPlan.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      this.prisma.payment.findMany({
        where: { organizationId, member: scope },
        select: { amount: true, paidAt: true, memberId: true },
      }),
      this.prisma.statusHistory.findMany({
        where: { member: { organizationId, ...scope } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { member: { select: { fullName: true, status: true } } },
      }),
    ]);

    const planNameById = new Map(plans.map((p) => [p.id, p.name]));

    const statusCounts = new Map<string, number>();
    const planCounts = new Map<string, number>();
    const growthCounts = new Map<string, number>(monthKeys.map((k) => [k, 0]));

    for (const m of members) {
      statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1);

      const planName = m.planId ? (planNameById.get(m.planId) ?? "Unknown") : "No Plan";
      planCounts.set(planName, (planCounts.get(planName) ?? 0) + 1);

      if (m.createdAt >= earliestMonth) {
        const key = monthKey(m.createdAt);
        growthCounts.set(key, (growthCounts.get(key) ?? 0) + 1);
      }
    }

    const now = new Date();
    const thisMonthKey = monthKey(now);
    let totalCollected = 0;
    let thisMonthCollected = 0;
    for (const p of payments) {
      const amount = p.amount.toNumber();
      totalCollected += amount;
      if (monthKey(p.paidAt) === thisMonthKey) thisMonthCollected += amount;
    }

    const statusBreakdown: Record<string, number> = {};
    statusCounts.forEach((count, key) => { statusBreakdown[key] = count; });

    const planBreakdown: Record<string, number> = {};
    planCounts.forEach((count, key) => { planBreakdown[key] = count; });

    const recentActivity = recentSh.map((sh) => ({
      id: sh.id,
      type: "status_change",
      message: `${sh.member.fullName} moved to ${sh.member.status}`,
      timestamp: sh.createdAt.toISOString(),
      status: sh.member.status,
    }));

    // True calendar-month bounds (today through the last instant of this
    // month) — a rolling 30-day-forward window would drift in meaning by day
    // of month (e.g. on the 30th it'd reach 29 days into next month), which
    // doesn't match what "expiring this month" tells the admin.
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const expiringThisMonthCount = await this.prisma.member.count({
      where: {
        organizationId,
        status: "ACTIVE",
        validUntil: { lte: endOfMonth, gte: now },
        ...scope,
      },
    });

    return {
      totalMembers: members.length,
      memberStatusBreakdown: Array.from(statusCounts.entries()).map(([name, count]) => ({ name, count })),
      statusBreakdown,
      memberGrowth: monthKeys.map((month) => ({ month, count: growthCounts.get(month) ?? 0 })),
      monthlyGrowth: monthKeys.map((month) => ({ month, members: growthCounts.get(month) ?? 0 })),
      planBreakdown,
      applicationFunnel: APPLICATION_FUNNEL_STATUSES.map((status) => ({
        name: status,
        count: statusCounts.get(status) ?? 0,
      })),
      totalCollected,
      totalCollection: totalCollected,
      thisMonthCollected,
      monthlyCollection: thisMonthCollected,
      monthlyCollections: this.bucketMonthlyAmounts(payments, monthKeys),
      recentActivity,
      expiringThisMonth: expiringThisMonthCount,
    };
  }

  // --- Detailed reports (9 types) -------------------------------------------

  async memberRegister(user: AuthUser): Promise<MemberRegisterRow[]> {
    const members = await this.prisma.member.findMany({
      where: { organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    return members.map(this.toMemberRegisterRow);
  }

  // Matches ApplicationsService.queue() (the Applications screen's own data
  // source) — AWAITING_PAYMENT is the standard pending-payment state, plus
  // any legacy SUBMITTED rows predating the form-first/payment-last redesign
  // that are still awaiting a manual-override approve()/reject().
  async pendingApproval(user: AuthUser): Promise<MemberRegisterRow[]> {
    return this.memberRegisterByStatus(user, ["AWAITING_PAYMENT", "SUBMITTED"]);
  }

  async rejectedApplications(user: AuthUser): Promise<MemberRegisterRow[]> {
    return this.memberRegisterByStatus(user, "REJECTED");
  }

  async paymentCollection(user: AuthUser): Promise<PaymentCollectionRow[]> {
    const payments = await this.prisma.payment.findMany({
      where: { organizationId: user.organizationId, member: buildJurisdictionWhere(user) },
      orderBy: { paidAt: "desc" },
      include: { member: { select: { fullName: true } }, receivedBy: { select: { email: true } } },
    });
    return payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      memberName: p.member.fullName,
      amount: p.amount.toNumber(),
      mode: p.mode,
      paidAt: p.paidAt,
      receivedByEmail: p.receivedBy.email,
    }));
  }

  async renewals(user: AuthUser): Promise<RenewalRow[]> {
    const renewalWindow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const members = await this.prisma.member.findMany({
      where: {
        organizationId: user.organizationId,
        status: "ACTIVE",
        validUntil: { lte: renewalWindow },
        ...buildJurisdictionWhere(user),
      },
      orderBy: { validUntil: "asc" },
      include: { plan: true },
    });
    return members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      membershipNumber: m.membershipNumber,
      mobile: m.mobile,
      planName: m.plan?.name ?? null,
      validUntil: m.validUntil,
    }));
  }

  async branchWise(user: AuthUser): Promise<NamedCount[]> {
    const [grouped, branches] = await Promise.all([
      this.prisma.member.groupBy({
        by: ["branchId"],
        where: { organizationId: user.organizationId, ...buildJurisdictionWhere(user) },
        _count: { _all: true },
      }),
      this.prisma.lookup.findMany({
        where: { organizationId: user.organizationId, category: "BRANCH" },
        select: { id: true, value: true },
      }),
    ]);
    const nameById = new Map(branches.map((b) => [b.id, b.value]));
    return grouped
      .map((g) => ({
        name: g.branchId ? (nameById.get(g.branchId) ?? "Unknown") : "Unassigned",
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async fieldExecutivePerformance(user: AuthUser): Promise<FieldExecutivePerformanceRow[]> {
    const scope = buildJurisdictionWhere(user);
    const [members, payments] = await Promise.all([
      this.prisma.member.findMany({
        where: { organizationId: user.organizationId, ...scope },
        select: { createdById: true, status: true },
      }),
      this.prisma.payment.findMany({
        where: { organizationId: user.organizationId, member: scope },
        select: { receivedById: true, amount: true },
      }),
    ]);

    const registeredCount = new Map<string, number>();
    const activeCount = new Map<string, number>();
    for (const m of members) {
      registeredCount.set(m.createdById, (registeredCount.get(m.createdById) ?? 0) + 1);
      if (m.status === "ACTIVE") activeCount.set(m.createdById, (activeCount.get(m.createdById) ?? 0) + 1);
    }
    const collected = new Map<string, number>();
    for (const p of payments) {
      collected.set(p.receivedById, (collected.get(p.receivedById) ?? 0) + p.amount.toNumber());
    }

    const feIds = new Set([...registeredCount.keys(), ...collected.keys()]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(feIds) }, role: "FIELD_EXECUTIVE" },
      select: { id: true, email: true },
    });

    return users
      .map((u) => ({
        userId: u.id,
        email: u.email,
        registeredCount: registeredCount.get(u.id) ?? 0,
        activeCount: activeCount.get(u.id) ?? 0,
        totalCollected: collected.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.registeredCount - a.registeredCount);
  }

  async revenueCollection(user: AuthUser): Promise<MonthlyAmount[]> {
    const monthKeys = lastNMonthKeys(MONTHS_BACK);
    const payments = await this.prisma.payment.findMany({
      where: { organizationId: user.organizationId, member: buildJurisdictionWhere(user) },
      select: { amount: true, paidAt: true },
    });
    return this.bucketMonthlyAmounts(payments, monthKeys);
  }

  // Shared by revenueCollection() and summary()'s monthlyCollections field —
  // both need the same trailing-12-months bucketing over a payments list.
  private bucketMonthlyAmounts(
    payments: { amount: { toNumber(): number }; paidAt: Date }[],
    monthKeys: string[],
  ): MonthlyAmount[] {
    const totals = new Map<string, number>(monthKeys.map((k) => [k, 0]));
    for (const p of payments) {
      const key = monthKey(p.paidAt);
      if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + p.amount.toNumber());
    }
    return monthKeys.map((month) => ({ month, amount: totals.get(month) ?? 0 }));
  }

  private async memberRegisterByStatus(
    user: AuthUser,
    status: MemberStatus | MemberStatus[],
  ): Promise<MemberRegisterRow[]> {
    const members = await this.prisma.member.findMany({
      where: {
        organizationId: user.organizationId,
        status: Array.isArray(status) ? { in: status } : status,
        ...buildJurisdictionWhere(user),
      },
      orderBy: { updatedAt: "desc" },
      include: { plan: true },
    });
    return members.map(this.toMemberRegisterRow);
  }

  private toMemberRegisterRow(m: {
    id: string;
    registrationNumber: string | null;
    membershipNumber: string | null;
    fullName: string;
    mobile: string;
    status: string;
    plan: { name: string } | null;
    createdAt: Date;
  }): MemberRegisterRow {
    return {
      id: m.id,
      registrationNumber: m.registrationNumber,
      membershipNumber: m.membershipNumber,
      fullName: m.fullName,
      mobile: m.mobile,
      status: m.status,
      planName: m.plan?.name ?? null,
      createdAt: m.createdAt,
    };
  }
}
