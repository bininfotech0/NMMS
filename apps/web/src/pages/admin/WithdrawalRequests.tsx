import { useState } from "react";
import { Check, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ApiError } from "@/lib/api-client";
import {
  useAdminWithdrawals,
  useApproveWithdrawal,
  useMarkWithdrawalPaid,
  useRejectWithdrawal,
} from "@/hooks/useWithdrawals";
import type { WithdrawalRequestResponse, WithdrawalStatus } from "@nmms/shared";

const TABS: { label: string; value: WithdrawalStatus | undefined }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Paid", value: "PAID" },
  { label: "All", value: undefined },
];

const STATUS_STYLES: Record<WithdrawalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-sky-100 text-sky-700",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

export function WithdrawalRequests() {
  const [status, setStatus] = useState<WithdrawalStatus | undefined>("PENDING");
  const { data: requests = [], isLoading, isError } = useAdminWithdrawals(status);
  const approve = useApproveWithdrawal();
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRequestResponse | null>(null);
  const [payTarget, setPayTarget] = useState<WithdrawalRequestResponse | null>(null);
  const [approveTarget, setApproveTarget] = useState<WithdrawalRequestResponse | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Withdrawal Requests</h1>
        <p className="text-sm text-muted-foreground">Review and process member withdrawal requests</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
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
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Charge</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={9} />}
            {isError && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-destructive">
                  Failed to load withdrawal requests.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.memberName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.pointsRequested}</TableCell>
                  <TableCell className="text-muted-foreground">₹{r.grossAmount}</TableCell>
                  <TableCell className="text-muted-foreground">₹{r.chargeAmount}</TableCell>
                  <TableCell className="font-medium">₹{r.netAmount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.payoutMethod === "BANK"
                      ? `Bank ...${r.payoutBankAccountNumberLast4 ?? ""}`
                      : r.payoutUpiId}
                  </TableCell>
                  <TableCell>
                    <Badge className={`border-transparent font-medium ${STATUS_STYLES[r.status]}`}>
                      {r.status[0] + r.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {r.status === "PENDING" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setApproveTarget(r)}>
                            <Check className="size-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRejectTarget(r)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setPayTarget(r)}>
                            <Landmark className="size-4" />
                            Mark Paid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRejectTarget(r)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && !isError && requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No withdrawal requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve this withdrawal?"
        description={
          approveTarget
            ? `${approveTarget.memberName} will be approved for ₹${approveTarget.netAmount}. You can still reject before marking it paid.`
            : ""
        }
        confirmLabel="Approve"
        destructive={false}
        isPending={approve.isPending}
        onConfirm={() => {
          if (!approveTarget) return;
          approve.mutate(approveTarget.id, { onSuccess: () => setApproveTarget(null) });
        }}
      />

      <RejectSheet target={rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} />
      <MarkPaidSheet target={payTarget} onOpenChange={(open) => !open && setPayTarget(null)} />
    </div>
  );
}

function RejectSheet({
  target,
  onOpenChange,
}: {
  target: WithdrawalRequestResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const rejectWithdrawal = useRejectWithdrawal();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setError(null);
    try {
      await rejectWithdrawal.mutateAsync({ id: target.id, note });
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Reject withdrawal</SheetTitle>
          <SheetDescription>
            {target ? `${target.memberName}'s request for ₹${target.netAmount} will be rejected.` : ""}
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">Reason</Label>
            <textarea
              id="reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" variant="destructive" disabled={rejectWithdrawal.isPending}>
              {rejectWithdrawal.isPending ? "Rejecting…" : "Reject Request"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
