import { useMemo, useState } from "react";
import { Landmark, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ApiError } from "@/lib/api-client";
import {
  useAdminWithdrawals,
  useCheckPayoutStatus,
  useInitiatePayout,
  useMarkWithdrawalPaid,
  usePayoutGatewayStatus,
} from "@/hooks/useWithdrawals";
import type { WithdrawalRequestResponse, WithdrawalStatus } from "@nmms/shared";

const TABS: { label: string; value: WithdrawalStatus | undefined; legacy?: boolean }[] = [
  { label: "Ready to pay", value: "APPROVED" },
  { label: "Being sent", value: "PAYOUT_PROCESSING" },
  { label: "Sending failed", value: "PAYOUT_FAILED" },
  { label: "Paid", value: "PAID" },
  // Older statuses from before automatic approval — shown for history only.
  { label: "Older: waiting", value: "PENDING", legacy: true },
  { label: "Older: not approved", value: "REJECTED", legacy: true },
  { label: "All", value: undefined },
];

const STATUS_STYLES: Record<WithdrawalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-sky-100 text-sky-700",
  PAYOUT_PROCESSING: "bg-indigo-100 text-indigo-700",
  PAYOUT_FAILED: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

export function WithdrawalRequests() {
  const [status, setStatus] = useState<WithdrawalStatus | undefined>("APPROVED");
  const { data: requests = [], isLoading, isError } = useAdminWithdrawals(status);
  const initiatePayout = useInitiatePayout();
  const checkPayoutStatus = useCheckPayoutStatus();
  const { data: gatewayStatus } = usePayoutGatewayStatus();
  const [payTarget, setPayTarget] = useState<WithdrawalRequestResponse | null>(null);
  const [payoutTarget, setPayoutTarget] = useState<WithdrawalRequestResponse | null>(null);
  const [showOlder, setShowOlder] = useState(false);

  const columns: DataGridColumn<WithdrawalRequestResponse>[] = useMemo(
    () => [
      { key: "memberName", header: "Member", sortable: true, cellClass: "font-medium" },
      {
        key: "pointsRequested",
        header: "Points",
        sortable: true,
        render: (r) => <span className="text-muted-foreground">{r.pointsRequested}</span>,
      },
      {
        key: "grossAmount",
        header: "Value",
        sortable: true,
        render: (r) => <span className="text-muted-foreground">₹{r.grossAmount}</span>,
      },
      {
        key: "chargeAmount",
        header: "Fee",
        render: (r) => <span className="text-muted-foreground">₹{r.chargeAmount}</span>,
      },
      { key: "netAmount", header: "To send", sortable: true, cellClass: "font-medium", render: (r) => `₹${r.netAmount}` },
      {
        key: "payoutMethod",
        header: "Method",
        render: (r) => (
          <span className="text-muted-foreground">
            {r.payoutMethod === "BANK" ? `Bank ...${r.payoutBankAccountNumberLast4 ?? ""}` : r.payoutUpiId}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (r) => (
          <Badge className={`border-transparent font-medium ${STATUS_STYLES[r.status]}`}>
            {r.status[0] + r.status.slice(1).toLowerCase().replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        key: "createdAt",
        header: "Requested",
        sortable: true,
        render: (r) => <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>,
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      requests.map((r) => ({
        memberName: r.memberName ?? "",
        pointsRequested: r.pointsRequested,
        grossAmount: r.grossAmount,
        chargeAmount: r.chargeAmount,
        netAmount: r.netAmount,
        payoutMethod: r.payoutMethod === "BANK" ? `Bank ...${r.payoutBankAccountNumberLast4 ?? ""}` : (r.payoutUpiId ?? ""),
        status: r.status,
        requestedAt: new Date(r.createdAt).toLocaleDateString(),
      })),
    [requests],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Money requests</h1>
          <p className="text-sm text-muted-foreground">Members' money requests. Send the money online, or mark it paid if you paid another way.</p>
        </div>
        <ExportCsvButton filename="withdrawal-requests.csv" rows={exportRows} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.filter((tab) => !tab.legacy || status === tab.value || showOlder).map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatus(tab.value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              status === tab.value
                ? "border-brand-green text-brand-green"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowOlder((v) => !v)}
          className="ml-auto px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {showOlder ? "Hide older requests" : "Show older requests"}
        </button>
      </div>

      <DataGrid
        columns={columns}
        data={requests}
        isLoading={isLoading}
        isError={isError}
        preserveOrder
        errorMessage="Failed to load withdrawal requests."
        emptyMessage="No withdrawal requests found."
        rowKey={(r) => r.id}
        searchable
        searchPlaceholder="Search by member name..."
        searchKeys={["memberName"]}
        pageSize={25}
        quickActions={(r) => (
          <div className="flex justify-end gap-2">
            {r.status === "APPROVED" && (
              <>
                {gatewayStatus?.enabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={initiatePayout.isPending}
                    onClick={() => setPayoutTarget(r)}
                  >
                    <Send className="size-4" />
                    Send money
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setPayTarget(r)}>
                  <Landmark className="size-4" />
                  Mark Paid
                </Button>
              </>
            )}
            {r.status === "PAYOUT_PROCESSING" && (
              <Button
                size="sm"
                variant="outline"
                disabled={checkPayoutStatus.isPending}
                onClick={() => checkPayoutStatus.mutate(r.id)}
              >
                <RefreshCw className="size-4" />
                Check Status
              </Button>
            )}
            {r.status === "PAYOUT_FAILED" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setPayTarget(r)}>
                  <Landmark className="size-4" />
                  Mark Paid
                </Button>
                {gatewayStatus?.enabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={initiatePayout.isPending}
                    onClick={() => setPayoutTarget(r)}
                  >
                    <Send className="size-4" />
                    Try again
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      />

      <MarkPaidSheet target={payTarget} onOpenChange={(open) => !open && setPayTarget(null)} />
      <ConfirmDialog
        open={!!payoutTarget}
        onOpenChange={(open) => !open && setPayoutTarget(null)}
        title={`Send ₹${payoutTarget?.netAmount ?? 0} to ${payoutTarget?.memberName ?? "this member"}?`}
        description={
          payoutTarget?.payoutMethod === "UPI"
            ? `Real money will be sent now to UPI ID ${payoutTarget?.payoutUpiId ?? ""}. This can't be undone.`
            : `Real money will be sent now to the bank account ending ${payoutTarget?.payoutBankAccountNumberLast4 ?? "????"}. This can't be undone.`
        }
        confirmLabel="Send money"
        destructive={false}
        isPending={initiatePayout.isPending}
        onConfirm={() =>
          payoutTarget && initiatePayout.mutate(payoutTarget.id, { onSettled: () => setPayoutTarget(null) })
        }
      />
    </div>
  );
}

function MarkPaidSheet({
  target,
  onOpenChange,
}: {
  target: WithdrawalRequestResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const markPaid = useMarkWithdrawalPaid();
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setError(null);
    try {
      await markPaid.mutateAsync({ id: target.id, paymentReference: paymentReference || undefined });
      setPaymentReference("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Mark withdrawal as paid</SheetTitle>
          <SheetDescription>
            {target
              ? `Confirm that ₹${target.netAmount} was transferred to ${target.memberName} outside the system.`
              : ""}
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="payment-reference">Payment reference (optional)</Label>
            <Input
              id="payment-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. bank UTR number"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={markPaid.isPending} className="bg-brand-green hover:bg-brand-green/90">
              {markPaid.isPending ? "Saving…" : "Mark Paid"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
