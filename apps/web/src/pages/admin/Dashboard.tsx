import { useMemo } from "react";
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
      pendingApprovals: reportData.statusBreakdown?.SUBMITTED ?? 0,
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
