import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Wallet, CreditCard, ArrowUpRight, IndianRupee, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { PayOnlineButton } from "@/components/payments/PayOnlineButton";
import { SharePaymentLinkButton } from "@/components/payments/SharePaymentLinkButton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useOutstandingMembers, usePayments, useRecordPayment } from "@/hooks/usePayments";
import { useGatewayStatus } from "@/hooks/usePaymentGateway";
import { useMembers } from "@/hooks/useMembers";
import { usePlans } from "@/hooks/usePlans";
import type { MemberResponse, PaymentMode, PaymentResponse } from "@nmms/shared";

const TABS = ["Outstanding", "History"] as const;
// ONLINE is included here for manual entry (e.g. staff recording a transfer
// they were shown proof of outside the app) — deliberately not excluded like
// upgradeMemberPlanSchema/manualDonationModeSchema do, per explicit product
// choice for this flow specifically. recordPaymentSchema already accepts it
// server-side; a gateway-verified payment reaches the same mode via
// PaymentGatewayService instead, never through this manual form.
const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "BANK", "CHEQUE", "ONLINE"];

const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI (Google Pay, PhonePe…)",
  BANK: "Bank transfer",
  CHEQUE: "Cheque",
  ONLINE: "Online — member pays by link or card",
};

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  Outstanding: "Still to pay",
  History: "Paid",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function Payments() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Outstanding");
  const [payTarget, setPayTarget] = useState<MemberResponse | null>(null);
  // "?collect=<memberId>" (from "Waiting for payment") opens the collect form for that member.
  const [searchParams, setSearchParams] = useSearchParams();
  const collectId = searchParams.get("collect");
  const { data: outstanding = [] } = useOutstandingMembers();
  useEffect(() => {
    if (!collectId) return;
    const member = outstanding.find((m) => m.id === collectId);
    if (member) {
      setPayTarget(member);
      setSearchParams({}, { replace: true });
    }
  }, [collectId, outstanding, setSearchParams]);

  const { data: allPayments = [], isLoading: paymentsLoading, isError: paymentsError } = usePayments();
  const { data: members = [] } = useMembers();
  const nameByMemberId = useMemo(() => new Map(members.map((m) => [m.id, m.fullName])), [members]);

  const paymentsWithMemberName = useMemo(
    () => allPayments.map((p) => ({ ...p, memberName: nameByMemberId.get(p.memberId) ?? "—" })),
    [allPayments, nameByMemberId],
  );

  const totalCollected = useMemo(() => allPayments.reduce((sum, p) => sum + p.amount, 0), [allPayments]);

  const paymentColumns: DataGridColumn<PaymentResponse & { memberName: string }>[] = useMemo(() => [
    { key: "receiptNumber", header: "Receipt #", sortable: true },
    { key: "memberName", header: "Member", sortable: true },
    { key: "amount", header: "Amount", sortable: true, align: "right", render: (p) => <span className="font-medium">{formatCurrency(p.amount)}</span> },
    { key: "mode", header: "Mode", sortable: true, render: (p) => <Badge variant="outline" className="border-transparent bg-muted font-medium">{(PAYMENT_MODE_LABELS[p.mode] ?? p.mode).split(" ")[0]}</Badge> },
    { key: "paidAt", header: "Date", sortable: true, render: (p) => new Date(p.paidAt).toLocaleDateString("en-IN") },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">{allPayments.length} payments · Total collected: {formatCurrency(totalCollected)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-brand-green/30 bg-brand-bg-soft">
          <CardContent className="flex items-center gap-3 py-4">
            <IndianRupee className="size-8 text-brand-green" />
            <div>
              <p className="text-2xl font-bold text-brand-green-dark">{formatCurrency(totalCollected)}</p>
              <p className="text-sm text-muted-foreground">Total Collection</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CreditCard className="size-8 text-brand-gold" />
            <div>
              <p className="text-2xl font-bold text-brand-brown">{allPayments.length}</p>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <ArrowUpRight className="size-8 text-brand-green" />
            <div>
              <p className="text-2xl font-bold">{allPayments.filter(p => p.mode === "UPI").length}</p>
              <p className="text-sm text-muted-foreground">UPI Payments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Wallet className="size-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{allPayments.filter(p => p.mode === "CASH").length}</p>
              <p className="text-sm text-muted-foreground">Cash Payments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-brand-green text-white"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "Outstanding" ? (
        <OutstandingTable onRecordPayment={setPayTarget} />
      ) : (
        <DataGrid
          columns={paymentColumns}
          data={paymentsWithMemberName}
          isLoading={paymentsLoading}
          isError={paymentsError}
          preserveOrder
          errorMessage="Failed to load payments."
          emptyMessage="No payments recorded yet."
          rowKey={(p) => p.id}
          searchable
          searchPlaceholder="Search by receipt, member..."
          searchKeys={["receiptNumber", "memberName"]}
          pageSize={25}
          quickActions={(p) => (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/admin/members/${p.memberId}/payments/${p.id}/receipt`}>
                <Printer className="size-4" />
              </Link>
            </Button>
          )}
        />
      )}

      <RecordPaymentSheet
        key={payTarget?.id ?? "none"}
        member={payTarget}
        onOpenChange={(open) => !open && setPayTarget(null)}
      />
    </div>
  );
}

function OutstandingTable({ onRecordPayment }: { onRecordPayment: (member: MemberResponse) => void }) {
  const { data: members = [], isLoading, isError } = useOutstandingMembers();
  const { data: plans = [] } = usePlans();
  const feeByPlanId = useMemo(() => new Map(plans.map((p) => [p.id, p.fee])), [plans]);

  const columns: DataGridColumn<MemberResponse>[] = useMemo(() => [
    { key: "fullName", header: "Member", sortable: true },
    { key: "membershipNumber", header: "Membership #", sortable: true, render: (m) => m.membershipNumber ?? "—" },
    { key: "mobile", header: "Mobile", sortable: true },
    { key: "planId", header: "Plan Fee", align: "right", render: (m) => m.planId && feeByPlanId.has(m.planId) ? formatCurrency(feeByPlanId.get(m.planId)!) : "—" },
  ], [feeByPlanId]);

  return (
    <DataGrid
      columns={columns}
      data={members}
      isLoading={isLoading}
      isError={isError}
      errorMessage="Failed to load outstanding members."
      emptyMessage="Everyone has paid. Nobody is waiting to pay right now."
      rowKey={(m) => m.id}
      searchable
      searchPlaceholder="Search members..."
      searchKeys={["fullName", "mobile", "membershipNumber"]}
      quickActions={(member) => (
        <Button
          size="sm"
          className="bg-brand-green hover:bg-brand-green/90"
          onClick={() => onRecordPayment(member)}
        >
          <Wallet className="size-4 mr-1" />
          Collect fee
        </Button>
      )}
    />
  );
}

function RecordPaymentSheet({
  member,
  onOpenChange,
}: {
  member: MemberResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: plans = [] } = usePlans();
  const { data: gatewayStatus } = useGatewayStatus();
  const plan = plans.find((p) => p.id === member?.planId);
  const onlineAvailable = gatewayStatus?.enabled ?? false;

  const [amount, setAmount] = useState(plan ? String(member?.feeOverride ?? plan.fee) : "");
  // Plans often load after the sheet opens — fill in the fee once known so
  // staff don't have to type it (and can't save an empty amount by mistake).
  const prefilled = useRef(!!plan);
  useEffect(() => {
    if (plan && !prefilled.current) {
      prefilled.current = true;
      setAmount(String(member?.feeOverride ?? plan.fee));
    }
  }, [plan, member]);
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [transactionNumber, setTransactionNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordPayment = useRecordPayment();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setError(null);
    if (!(Number(amount) > 0)) {
      setError("Please enter the amount you received.");
      return;
    }
    try {
      await recordPayment.mutateAsync({
        memberId: member.id,
        dto: { amount: Number(amount), mode, transactionNumber: transactionNumber || null, remarks: remarks || null },
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) {
          setAmount(plan ? String(plan.fee) : "");
          setMode("CASH");
          setTransactionNumber("");
          setRemarks("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Collect the fee</SheetTitle>
          <SheetDescription>
            {member ? `From ${member.fullName}. Choose how they are paying. Their membership starts as soon as you save.` : null}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 px-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mode">How are they paying?</Label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as PaymentMode)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {mode === "ONLINE" && onlineAvailable ? (
            <>
              {member && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <PayOnlineButton
                    memberId={member.id}
                    onError={setError}
                    onSuccess={() => onOpenChange(false)}
                    className="flex-1 bg-brand-green hover:bg-brand-green/90"
                  />
                  <SharePaymentLinkButton memberId={member.id} memberName={member.fullName} className="flex-1" />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          ) : (
            <form className="flex flex-1 flex-col gap-4" onSubmit={handleSubmit}>
              {mode !== "CASH" && (
                <div className="space-y-1.5">
                  <Label htmlFor="transactionNumber">Reference number (UPI / bank / cheque)</Label>
                  <Input
                    id="transactionNumber"
                    placeholder="Printed on the payment screen or cheque"
                    value={transactionNumber}
                    onChange={(e) => setTransactionNumber(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="remarks">Remarks (optional)</Label>
                <Input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <SheetFooter className="px-0">
                <Button
                  type="submit"
                  disabled={recordPayment.isPending}
                  className="bg-brand-green hover:bg-brand-green/90"
                >
                  {recordPayment.isPending ? "Saving…" : "Money received — save"}
                </Button>
              </SheetFooter>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
