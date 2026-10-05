import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApplicationsQueue } from "@/hooks/useApplications";
import { useAdminWithdrawals } from "@/hooks/useWithdrawals";
import { useDonationsAdminList } from "@/hooks/useDonations";
import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { TopReferrersCard } from "@/components/dashboard/TopReferrersCard";
import { useReportsSummary } from "@/hooks/useReports";
import { useAuthStore } from "@/stores/auth";
import { Role } from "@nmms/shared";
import type { DashboardSummary } from "@/components/dashboard/ExecutiveDashboard";

const CAN_VIEW_ORG_WIDE_REPORTS: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

export function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const canViewOrgWideReports = !!user && CAN_VIEW_ORG_WIDE_REPORTS.includes(user.role);
  // /reports/summary scopes by jurisdiction server-side, so field executives
  // get their own numbers back — safe to query for every signed-in staff role.
  const { data: reportData, isLoading } = useReportsSummary(!!user);

  const summary = useMemo<DashboardSummary | null>(() => {
    if (!reportData) return null;
    return {
      totalMembers: reportData.totalMembers ?? 0,
      activeMembers: reportData.statusBreakdown?.ACTIVE ?? 0,
      pendingApprovals:
        (reportData.statusBreakdown?.AWAITING_PAYMENT ?? 0) + (reportData.statusBreakdown?.SUBMITTED ?? 0),
      monthlyRegistrations: (reportData.monthlyGrowth ?? []).slice(-1)[0]?.members ?? 0,
      totalCollections: reportData.totalCollection ?? 0,
      monthlyCollection: reportData.monthlyCollection ?? 0,
      statusBreakdown: reportData.statusBreakdown ?? {},
      planBreakdown: reportData.planBreakdown ?? {},
      monthlyGrowth: reportData.monthlyGrowth ?? [],
      recentActivity: reportData.recentActivity ?? [],
      expiringThisMonth: reportData.expiringThisMonth ?? 0,
    };
  }, [reportData]);

  return (
    <div className="space-y-6">
      <TodoToday canManagePayouts={canViewOrgWideReports} expiringThisMonth={summary?.expiringThisMonth ?? 0} />
      <ExecutiveDashboard
        summary={summary}
        isLoading={isLoading}
        fieldExecDashboard={user?.role === Role.FIELD_EXECUTIVE}
        role={user?.role}
      />
      {canViewOrgWideReports && <TopReferrersCard />}
    </div>
  );
}

// Plain "what needs doing" list so staff don't have to read the charts to
// find their work. Each row links straight to the page where it's done.
function TodoToday({ canManagePayouts, expiringThisMonth }: { canManagePayouts: boolean; expiringThisMonth: number }) {
  const { data: waiting = [] } = useApplicationsQueue();
  const { data: payouts = [] } = useAdminWithdrawals("APPROVED", canManagePayouts);
  const { data: donationsToCheck = [] } = useDonationsAdminList("PENDING");

  const items = [
    {
      count: waiting.length,
      text: `${waiting.length === 1 ? "person has" : "people have"} registered but not paid yet`,
      action: "Collect payment",
      to: "/admin/applications",
    },
    {
      count: donationsToCheck.length,
      text: `donation${donationsToCheck.length === 1 ? "" : "s"} to check (cash, UPI or cheque a member says they gave)`,
      action: "Check",
      to: "/admin/donations",
    },
    ...(canManagePayouts
      ? [{ count: payouts.length, text: `money request${payouts.length === 1 ? "" : "s"} ready to send to members`, action: "Send money", to: "/admin/withdrawals" }]
      : []),
    {
      count: expiringThisMonth,
      text: `membership${expiringThisMonth === 1 ? "" : "s"} end this month`,
      action: "See who",
      to: "/admin/reports",
    },
  ].filter((item) => item.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">To do today</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-brand-green" /> Nothing waiting for you right now.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.to} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{item.count}</span> {item.text}
                </span>
                <Link to={item.to} className="inline-flex shrink-0 items-center gap-1 font-medium text-brand-green hover:underline">
                  {item.action} <ArrowRight className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
