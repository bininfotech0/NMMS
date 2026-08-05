import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  Clock,
  Wallet,
  AlertCircle,
  ClipboardCheck,
  Bell,
  Activity,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "./StatCard";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { DonutBreakdown } from "./DonutBreakdown";
import { StatusBadge } from "@/components/shared/StatusBadge";

export interface DashboardSummary {
  totalMembers: number;
  activeMembers: number;
  pendingApprovals: number;
  pendingPayments: number;
  monthlyRegistrations: number;
  totalCollections: number;
  monthlyCollection: number;
  statusBreakdown: Record<string, number>;
  planBreakdown: Record<string, number>;
  monthlyGrowth: Array<{ month: string; members: number }>;
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    status?: string;
  }>;
  expiringThisMonth: number;
}

const STAT_ICONS = [Users, UserCheck, Clock, Wallet] as const;
const STAT_ACCENTS = ["green", "gold", "brown", "muted"] as const;

const QUICK_ACTIONS = [
  { label: "New Registration", icon: UserPlus, to: "/admin/members/new/wizard", color: "bg-brand-green text-white" },
  { label: "Review Applications", icon: ClipboardCheck, to: "/admin/applications", color: "bg-brand-gold text-brand-brown" },
  { label: "Record Payment", icon: Wallet, to: "/admin/payments", color: "bg-blue-600 text-white" },
  { label: "Create Notice", icon: Bell, to: "/admin/notices", color: "bg-purple-600 text-white" },
];

export function ExecutiveDashboard({
  summary,
  fieldExecDashboard,
  role,
}: {
  summary: DashboardSummary;
  fieldExecDashboard?: boolean;
  role?: string;
}) {
  const navigate = useNavigate();

  const statCards = useMemo(() => [
    { label: "Total Members", value: summary.totalMembers.toLocaleString(), trend: `+${summary.monthlyRegistrations} this month`, trendUp: true },
    { label: "Active Members", value: summary.activeMembers.toLocaleString(), trend: `${((summary.activeMembers / Math.max(summary.totalMembers, 1)) * 100).toFixed(1)}% active`, trendUp: true },
    { label: "Pending Approval", value: summary.pendingApprovals.toString(), trend: `${summary.expiringThisMonth} expiring this month`, trendUp: summary.expiringThisMonth < 10 },
    { label: "Total Collections", value: `₹${summary.totalCollections.toLocaleString()}`, trend: `+₹${summary.monthlyCollection.toLocaleString()} this month`, trendUp: true },
  ], [summary]);

  const statusStats = useMemo(() => {
    const total = Object.values(summary.statusBreakdown).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(summary.statusBreakdown).map(([key, value]) => ({
      key,
      value,
      percentage: ((value / total) * 100).toFixed(1),
    }));
  }, [summary.statusBreakdown]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {fieldExecDashboard ? "Field Executive Dashboard" : "Executive Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {role ? `${role.replace(/_/g, " ")} · ` : ""}
            Real-time overview as of {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat, i) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            trend={stat.trend}
            trendUp={stat.trendUp}
            icon={STAT_ICONS[i]}
            accent={STAT_ACCENTS[i]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className={cn(
              "flex items-center justify-between rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md",
              action.color,
            )}
          >
            <div>
              <action.icon className="mb-2 size-6 opacity-90" />
              <p className="text-sm font-medium opacity-90">{action.label}</p>
            </div>
            <ArrowRight className="size-5 opacity-70" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Membership Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.monthlyGrowth} margin={{ left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }} />
                <Line type="monotone" dataKey="members" stroke="var(--brand-green)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Membership Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusStats.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.key} />
                    <span className="text-sm text-muted-foreground">{s.key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.value}</span>
                    <span className="text-xs text-muted-foreground">({s.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutBreakdown
              title=""
              data={Object.entries(summary.planBreakdown).map(([key, value]) => ({
                type: key,
                value,
                color: ["var(--brand-green)", "var(--brand-gold)", "var(--brand-brown)", "var(--brand-gray)"][
                  Object.keys(summary.planBreakdown).indexOf(key) % 4
                ],
              }))}
              labelKey="type"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
              )}
              {summary.recentActivity.slice(0, 6).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Activity className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {activity.status && <StatusBadge status={activity.status} />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.pendingApprovals > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="size-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {summary.pendingApprovals} application{summary.pendingApprovals === 1 ? "" : "s"} awaiting review
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {summary.expiringThisMonth} memberships expiring this month
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800"
              onClick={() => navigate("/admin/applications")}
            >
              Review Now
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
