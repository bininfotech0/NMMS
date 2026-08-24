import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Banknote, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ApiError } from "@/lib/api-client";
import { useMyReferralLedger } from "@/hooks/useReferrals";
import { useMyKyc } from "@/hooks/useKyc";
import {
  useCreateWithdrawalRequest,
  useMyWalletSummary,
  useMyWithdrawalRate,
  useMyWithdrawals,
} from "@/hooks/useWithdrawals";
import type { ReferralLedgerEntryResponse, WalletSummaryResponse, WithdrawalStatus } from "@nmms/shared";

const STAT_CARDS: { key: keyof WalletSummaryResponse; label: string; isAmount?: boolean }[] = [
  { key: "earnedPoints", label: "Earned Points" },
  { key: "pendingReviewPoints", label: "Awaiting Review" },
  { key: "pendingPoints", label: "Withdrawal Pending" },
  { key: "approvedPoints", label: "Withdrawal Approved" },
  { key: "convertedPoints", label: "Converted Points" },
  { key: "availableBalancePoints", label: "Available Balance (pts)" },
  { key: "withdrawnAmount", label: "Withdrawn Amount", isAmount: true },
];

const WITHDRAWAL_STATUS_STYLES: Record<WithdrawalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-sky-100 text-sky-700",
  PAYOUT_PROCESSING: "bg-indigo-100 text-indigo-700",
  PAYOUT_FAILED: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

// Ledger rows are always visible; only PENDING/REJECTED get a badge — the
// still-common APPROVED/CONVERTED cases keep today's plain credit/debit look.
const LEDGER_STATUS_STYLES: Partial<Record<ReferralLedgerEntryResponse["status"], string>> = {
  PENDING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
};
const LEDGER_STATUS_LABELS: Partial<Record<ReferralLedgerEntryResponse["status"], string>> = {
  PENDING: "Pending review",
  REJECTED: "Not approved",
};

const LEDGER_REASON_LABELS: Record<string, (entry: ReferralLedgerEntryResponse) => string> = {
  REFERRAL_APPROVED: (entry) =>
    entry.relatedMemberName ? `${entry.relatedMemberName} joined and was approved` : "Referral approved",
  EVENT_TARGET_COMPLETED: (entry) => (entry.relatedEventTitle ? `Event: ${entry.relatedEventTitle}` : "Event points"),
  WITHDRAWAL_CONVERTED: () => "Withdrawal paid out",
  DONATION_RECEIVED: (entry) =>
    entry.relatedDonationReceiptNumber ? `Donation received (receipt ${entry.relatedDonationReceiptNumber})` : "Donation received",
};

export function MemberWallet() {
  const { data: summary } = useMyWalletSummary();
  const { data: ledger, isLoading: ledgerLoading } = useMyReferralLedger();
  const { data: withdrawals, isLoading: withdrawalsLoading } = useMyWithdrawals();
  const { data: kyc } = useMyKyc();
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const canWithdraw = kyc?.kycStatus === "VERIFIED" && kyc.isComplete;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STAT_CARDS.map(({ key, label, isAmount }) => (
          <Card key={key} className="gap-1 py-3">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold text-brand-green">
                {isAmount ? `₹${(summary?.[key] as number) ?? 0}` : (summary?.[key] as number) ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-3 py-4">
        <CardContent className="flex items-center justify-between gap-4 px-4">
          <div>
            <p className="text-sm text-muted-foreground">Available to withdraw</p>
            <p className="mt-1 text-2xl font-bold text-brand-green">₹{summary?.availableBalanceAmount ?? 0}</p>
          </div>
          {canWithdraw ? (
            <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => setWithdrawOpen(true)}>
              <Wallet className="size-4" />
              Withdraw
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link to="/member/kyc">
                <ShieldAlert className="size-4" />
                Complete KYC to withdraw
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal requests</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !withdrawals || withdrawals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Banknote className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {withdrawals.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p>
                      {w.pointsRequested} pts · ₹{w.netAmount} net
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={`border-transparent font-medium ${WITHDRAWAL_STATUS_STYLES[w.status]}`}>
                    {w.status[0] + w.status.slice(1).toLowerCase().replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points history</CardTitle>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !ledger || ledger.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Receipt className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No points activity yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {ledger.map((entry) => {
                const isCredit = entry.points >= 0;
                const label = LEDGER_REASON_LABELS[entry.reason]?.(entry) ?? entry.note ?? "Manual adjustment";
                const statusStyle = LEDGER_STATUS_STYLES[entry.status];
                const statusLabel = LEDGER_STATUS_LABELS[entry.status];
                return (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div
                      className={
                        isCredit
                          ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green"
                          : "flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                      }
                    >
                      {isCredit ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate">{label}</p>
                        {statusStyle && statusLabel && (
                          <Badge className={`shrink-0 border-transparent font-medium ${statusStyle}`}>
                            {statusLabel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={isCredit ? "font-medium text-brand-green" : "font-medium text-destructive"}>
                      {isCredit ? "+" : ""}
                      {entry.points}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <WithdrawSheet
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        availablePoints={summary?.availableBalancePoints ?? 0}
      />
    </div>
  );
}

function WithdrawSheet({
  open,
  onOpenChange,
  availablePoints,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePoints: number;
}) {
  const { data: rate } = useMyWithdrawalRate();
  const createRequest = useCreateWithdrawalRequest();
  const [points, setPoints] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pointsNum = Number(points) || 0;
  const preview = (() => {
    if (!rate || pointsNum <= 0) return null;
    const gross = (pointsNum / rate.pointsToMoneyRatioPoints) * rate.pointsToMoneyRatioAmount;
    let charge = 0;
    if (rate.withdrawalChargeType === "FLAT") charge = Math.min(rate.withdrawalChargeValue, gross);
    else if (rate.withdrawalChargeType === "PERCENTAGE") charge = (gross * rate.withdrawalChargeValue) / 100;
    return { gross, charge, net: gross - charge };
  })();

  function reset() {
    setPoints("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRequest.mutateAsync({ pointsRequested: pointsNum });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Withdraw points</SheetTitle>
          <SheetDescription>You have {availablePoints} points available to withdraw.</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="points">Points to withdraw</Label>
            <Input
              id="points"
              type="number"
              min="1"
              max={availablePoints}
              step="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              required
            />
          </div>
          {preview && (
            <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross amount</span>
                <span>₹{preview.gross.toFixed(2)}</span>
              </div>
              {preview.charge > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Withdrawal charge</span>
                  <span>-₹{preview.charge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>You receive</span>
                <span>₹{preview.net.toFixed(2)}</span>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={createRequest.isPending}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {createRequest.isPending ? "Submitting…" : "Request Withdrawal"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
