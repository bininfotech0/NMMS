import { useMemo } from "react";
import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { TopReferrersCard } from "@/components/dashboard/TopReferrersCard";
import { memberGrowth } from "@/lib/mock-data";
import { useReportsSummary } from "@/hooks/useReports";
import { useAuthStore } from "@/stores/auth";
import type { DashboardSummary } from "@/components/dashboard/ExecutiveDashboard";

const emptySummary: DashboardSummary = {
  totalMembers: 3250,
  activeMembers: 2750,
  pendingApprovals: 150,
  pendingPayments: 45,
  monthlyRegistrations: 280,
  totalCollections: 4560000,
  monthlyCollection: 45600,
  statusBreakdown: { ACTIVE: 2750, PAYMENT_COLLECTED: 120, SUBMITTED: 150, DRAFT: 80, REJECTED: 30, EXPIRED: 120 },
  planBreakdown: { Annual: 45, Lifetime: 25, Family: 20, Student: 10 },
  monthlyGrowth: memberGrowth.map((m) => ({ month: m.month, members: m.members })),
  recentActivity: [
    { id: "1", type: "registration", message: "Amit Kumar registered as Annual Member", timestamp: "2024-05-12T10:30:00Z", status: "ACTIVE" },
    { id: "2", type: "registration", message: "Pooja Singh registered as Lifetime Member", timestamp: "2024-05-12T09:15:00Z", status: "ACTIVE" },
    { id: "3", type: "payment", message: "Payment received from Ramesh Mahto — ₹500", timestamp: "2024-05-11T14:20:00Z", status: "ACTIVE" },
    { id: "4", type: "submission", message: "Neha Kumari submitted application", timestamp: "2024-05-10T11:45:00Z", status: "SUBMITTED" },
  ],
  expiringThisMonth: 12,
};

export function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const { data: reportData } = useReportsSummary();

  const summary = useMemo(() => {
    if (!reportData) return emptySummary;
    return {
      ...emptySummary,
      totalMembers: reportData.totalMembers ?? 0,
      activeMembers: reportData.statusBreakdown?.ACTIVE ?? 0,
      pendingApprovals: reportData.statusBreakdown?.SUBMITTED ?? 0,
      monthlyRegistrations: (reportData.monthlyGrowth ?? emptySummary.monthlyGrowth).slice(-1)[0]?.members ?? 0,
      totalCollections: reportData.totalCollection ?? 0,
      monthlyCollection: reportData.monthlyCollection ?? 0,
      statusBreakdown: reportData.statusBreakdown ?? emptySummary.statusBreakdown,
      planBreakdown: reportData.planBreakdown ?? emptySummary.planBreakdown,
      monthlyGrowth: reportData.monthlyGrowth ?? emptySummary.monthlyGrowth,
      recentActivity: reportData.recentActivity ?? emptySummary.recentActivity,
    };
  }, [reportData]);

  return (
    <div className="space-y-6">
      <ExecutiveDashboard
        summary={summary}
        role={user?.role}
      />
      <TopReferrersCard />
    </div>
  );
}
