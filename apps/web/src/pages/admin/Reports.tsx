import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Users, Wallet, CalendarClock, UserCheck } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import {
  useBranchWiseReport,
  useFieldExecutivePerformanceReport,
  useMemberRegisterReport,
  usePaymentCollectionReport,
  usePendingApprovalReport,
  useRejectedApplicationsReport,
  useRenewalsReport,
  useReportsSummary,
  useRevenueCollectionReport,
} from "@/hooks/useReports";
import type {
  FieldExecutivePerformanceRow,
  MemberRegisterRow,
  MonthlyAmount,
  NamedCount,
  PaymentCollectionRow,
  RenewalRow,
} from "@nmms/shared";

const PALETTE = [
  "var(--brand-green)",
  "var(--brand-gold)",
  "var(--brand-brown)",
  "var(--brand-gray)",
  "#6366f1",
  "#0ea5e9",
  "#ec4899",
  "#f97316",
];

function colorAt(index: number) {
  return PALETTE[index % PALETTE.length];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function titleCase(s: string) {
  return s
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ");
}

const chartTooltipStyle = { borderRadius: 8, borderColor: "var(--border)", fontSize: 12 };

export function Reports() {
  const { data, isLoading, isError, error } = useReportsSummary();
  const forbidden = isError && error instanceof ApiError && error.status === 403;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Aggregate insights into membership growth, collections, and application status.
        </p>
      </div>

      {isLoading && <ReportsSummarySkeleton />}

      {forbidden && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          You don't have permission to view reports.
        </p>
      )}

      {isError && !forbidden && (
        <p className="py-10 text-center text-sm text-destructive">Failed to load reports.</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Members" value={String(data.totalMembers)} icon={Users} accent="green" />
            <SummaryCard
              label="Active Members"
              value={String(
                data.memberStatusBreakdown.find((s) => s.name === "ACTIVE")?.count ?? 0,
              )}
              icon={UserCheck}
              accent="gold"
            />
            <SummaryCard
              label="Total Collected"
              value={formatCurrency(data.totalCollected)}
              icon={Wallet}
              accent="brown"
            />
            <SummaryCard
              label="This Month's Collection"
              value={formatCurrency(data.thisMonthCollected)}
              icon={CalendarClock}
              accent="muted"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Member Growth (12 months)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.memberGrowth} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="New members"
                      stroke="var(--brand-green)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Collections (12 months)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyCollections ?? []} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="amount" name="Collected" fill="var(--brand-gold)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BreakdownList
              title="Member Status"
              data={data.memberStatusBreakdown}
              formatName={titleCase}
            />
            <BreakdownList
              title="Application Funnel"
              data={data.applicationFunnel}
              formatName={titleCase}
            />
            <BreakdownList
              className="sm:col-span-2 lg:col-span-1"
              title="Membership Plans"
              data={Object.entries(data.planBreakdown ?? {}).map(([name, count]) => ({ name, count }))}
              formatName={(s) => s}
            />
          </div>
        </>
      )}

      <DetailedReports />
    </div>
  );
}

function ReportsSummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-3 py-4">
            <CardContent className="flex items-center justify-between px-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-20" />
              </div>
              <Skeleton className="size-10 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="h-full">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="h-64">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type ReportKey =
  | "member-register"
  | "pending-approval"
  | "rejected-applications"
  | "payment-collection"
  | "renewals"
  | "branch-wise"
  | "field-executive-performance"
  | "revenue-collection";

const REPORT_LABELS: Record<ReportKey, string> = {
  "member-register": "Member Register",
  "pending-approval": "Pending Approval",
  "rejected-applications": "Rejected Applications",
  "payment-collection": "Payment Collection",
  renewals: "Membership Renewal",
  "branch-wise": "Branch Wise Members",
  "field-executive-performance": "Field Executive Performance",
  "revenue-collection": "Revenue Collection",
};

function DetailedReports() {
  const [report, setReport] = useState<ReportKey>("member-register");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Detailed Reports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REPORT_LABELS) as ReportKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setReport(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                report === key
                  ? "bg-brand-green text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {REPORT_LABELS[key]}
            </button>
          ))}
        </div>
        <ReportTable report={report} />
      </CardContent>
    </Card>
  );
}

function ReportTable({ report }: { report: ReportKey }) {
  switch (report) {
    case "member-register":
      return <MemberRegisterTable useHook={useMemberRegisterReport} filename="member-register.csv" />;
    case "pending-approval":
      return <MemberRegisterTable useHook={usePendingApprovalReport} filename="pending-approval.csv" />;
    case "rejected-applications":
      return <MemberRegisterTable useHook={useRejectedApplicationsReport} filename="rejected-applications.csv" />;
    case "payment-collection":
      return <PaymentCollectionTable />;
    case "renewals":
      return <RenewalsTable />;
    case "branch-wise":
      return <NamedCountTable useHook={useBranchWiseReport} filename="branch-wise.csv" />;
    case "field-executive-performance":
      return <FieldExecutivePerformanceTable />;
    case "revenue-collection":
      return <RevenueCollectionTable />;
  }
}

function MemberRegisterTable({
  useHook,
  filename,
}: {
  useHook: () => { data?: MemberRegisterRow[]; isLoading: boolean; isError: boolean };
  filename: string;
}) {
  const { data = [], isLoading, isError } = useHook();
  const columns: DataGridColumn<MemberRegisterRow>[] = [
    { key: "registrationNumber", header: "Reg. No.", sortable: true, render: (r) => r.registrationNumber ?? "—" },
    { key: "membershipNumber", header: "Member ID", sortable: true, render: (r) => r.membershipNumber ?? "—" },
    { key: "fullName", header: "Name", sortable: true },
    { key: "mobile", header: "Mobile", sortable: true },
    { key: "status", header: "Status", sortable: true },
    { key: "planName", header: "Plan", sortable: true, render: (r) => r.planName ?? "—" },
    { key: "createdAt", header: "Registered", sortable: true, render: (r) => new Date(r.createdAt).toLocaleDateString("en-IN") },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportCsvButton filename={filename} rows={data} /></div>
      <DataGrid columns={columns} data={data} isLoading={isLoading} isError={isError} preserveOrder exportable={false} rowKey={(r) => r.id} emptyMessage="No records." />
    </div>
  );
}

function PaymentCollectionTable() {
  const { data = [], isLoading, isError } = usePaymentCollectionReport();
  const columns: DataGridColumn<PaymentCollectionRow>[] = [
    { key: "receiptNumber", header: "Receipt #", sortable: true },
    { key: "memberName", header: "Member", sortable: true },
    { key: "amount", header: "Amount", sortable: true, align: "right" },
    { key: "mode", header: "Mode", sortable: true },
    { key: "paidAt", header: "Date", sortable: true, render: (r) => new Date(r.paidAt).toLocaleDateString("en-IN") },
    { key: "receivedByEmail", header: "Received By", sortable: true },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportCsvButton filename="payment-collection.csv" rows={data} /></div>
      <DataGrid columns={columns} data={data} isLoading={isLoading} isError={isError} preserveOrder exportable={false} rowKey={(r) => r.id} emptyMessage="No payments." />
    </div>
  );
}

function RenewalsTable() {
  const { data = [], isLoading, isError } = useRenewalsReport();
  const columns: DataGridColumn<RenewalRow>[] = [
    { key: "fullName", header: "Member", sortable: true },
    { key: "membershipNumber", header: "Member ID", sortable: true, render: (r) => r.membershipNumber ?? "—" },
    { key: "mobile", header: "Mobile", sortable: true },
    { key: "planName", header: "Plan", sortable: true, render: (r) => r.planName ?? "—" },
    { key: "validUntil", header: "Valid Until", sortable: true, render: (r) => (r.validUntil ? new Date(r.validUntil).toLocaleDateString("en-IN") : "—") },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportCsvButton filename="renewals.csv" rows={data} /></div>
      <DataGrid columns={columns} data={data} isLoading={isLoading} isError={isError} exportable={false} rowKey={(r) => r.id} emptyMessage="No renewals due." />
    </div>
  );
}

function NamedCountTable({
  useHook,
  filename,
}: {
  useHook: () => { data?: NamedCount[]; isLoading: boolean; isError: boolean };
  filename: string;
}) {
  const { data = [], isLoading, isError } = useHook();
  const columns: DataGridColumn<NamedCount>[] = [
    { key: "name", header: "Name", sortable: true },
    { key: "count", header: "Members", sortable: true, align: "right" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportCsvButton filename={filename} rows={data} /></div>
      <DataGrid columns={columns} data={data} isLoading={isLoading} isError={isError} exportable={false} rowKey={(r) => r.name} emptyMessage="No data." />
    </div>
  );
}

function FieldExecutivePerformanceTable() {
  const { data = [], isLoading, isError } = useFieldExecutivePerformanceReport();
  const columns: DataGridColumn<FieldExecutivePerformanceRow>[] = [
    { key: "email", header: "Field Executive", sortable: true },
    { key: "registeredCount", header: "Registered", sortable: true, align: "right" },
    { key: "activeCount", header: "Active", sortable: true, align: "right" },
    { key: "totalCollected", header: "Collected", sortable: true, align: "right", render: (r) => formatCurrency(r.totalCollected) },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportCsvButton filename="field-executive-performance.csv" rows={data} /></div>
      <DataGrid columns={columns} data={data} isLoading={isLoading} isError={isError} exportable={false} rowKey={(r) => r.userId} emptyMessage="No field executives yet." />
    </div>
  );
}

function RevenueCollectionTable() {
  const { data = [], isLoading, isError } = useRevenueCollectionReport();
  const columns: DataGridColumn<MonthlyAmount>[] = [
    { key: "month", header: "Month", sortable: true },
    { key: "amount", header: "Revenue", sortable: true, align: "right", render: (r) => formatCurrency(r.amount) },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportCsvButton filename="revenue-collection.csv" rows={data} /></div>
      <DataGrid columns={columns} data={data} isLoading={isLoading} isError={isError} exportable={false} rowKey={(r) => r.month} emptyMessage="No revenue yet." />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent = "green",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "green" | "gold" | "brown" | "muted";
}) {
  const ACCENTS = {
    green: "bg-brand-green/10 text-brand-green",
    gold: "bg-brand-gold/15 text-brand-gold",
    brown: "bg-brand-brown/10 text-brand-brown",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="gap-3 py-4 transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between px-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg", ACCENTS[accent])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownList({
  title,
  data,
  formatName,
  className,
}: {
  title: string;
  data: NamedCount[];
  formatName: (name: string) => string;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <Card className={cn("h-full transition-shadow hover:shadow-md", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((d, i) => (
          <div key={d.name}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{formatName(d.name)}</span>
              <span className="font-medium">{d.count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: total > 0 ? `${(d.count / total) * 100}%` : "0%",
                  backgroundColor: colorAt(i),
                }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
      </CardContent>
    </Card>
  );
}
