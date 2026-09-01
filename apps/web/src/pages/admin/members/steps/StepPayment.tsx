import { useEffect, useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PayOnlineButton } from "@/components/payments/PayOnlineButton";
import { SharePaymentLinkButton } from "@/components/payments/SharePaymentLinkButton";
import { ApiError } from "@/lib/api-client";
import { useMember, useMemberPayments } from "@/hooks/useMembers";
import { useRecordPayment } from "@/hooks/usePayments";
import { useGatewayStatus } from "@/hooks/usePaymentGateway";
import { usePlans } from "@/hooks/usePlans";
import type { PaymentMode } from "@nmms/shared";
import type { StepProps } from "../wizard-types";

const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "BANK", "CHEQUE"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

// The last step of the wizard — the application has already been submitted
// (AWAITING_PAYMENT), and collecting the fee here auto-activates the member
// immediately, with no separate manual-review step. The backend enforces the
// AWAITING_PAYMENT precondition too (PaymentsService.assertPayable).
export function StepPayment({ form, memberId }: StepProps) {
  const { data: member } = useMember(memberId);
  const { data: plans = [] } = usePlans();
  const { data: payments = [] } = useMemberPayments(memberId);
  const { data: gatewayStatus } = useGatewayStatus();
  const recordPayment = useRecordPayment();
  const onlineAvailable = gatewayStatus?.enabled ?? false;

  const plan = plans.find((p) => p.id === form.planId);
  const defaultAmount = form.feeOverride || (plan ? String(plan.fee) : "");
  const [amount, setAmount] = useState(defaultAmount);
  // Plans can still be loading on first render (cold cache), in which case
  // defaultAmount is "" here even though a plan fee will apply — backfill
  // once it resolves, but only if the field is still untouched so this never
  // clobbers something the user already typed.
  useEffect(() => {
    if (!amount && defaultAmount) setAmount(defaultAmount);
  }, [defaultAmount]);
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [transactionNumber, setTransactionNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const activated = member?.status === "ACTIVE";
  const notYetSubmitted = member?.status === "DRAFT";

  async function handleCollect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordPayment.mutateAsync({
        memberId,
        dto: {
          amount: Number(amount),
          mode,
          transactionNumber: transactionNumber || null,
          remarks: remarks || null,
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (activated) {
    const payment = payments[0];
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-brand-green/30 bg-brand-bg-soft py-10 text-center">
        <CheckCircle2 className="size-10 text-brand-green" />
        <div>
          <p className="font-medium text-brand-green-dark">
            Membership active{member?.membershipNumber ? ` — #${member.membershipNumber}` : ""}
          </p>
          {payment && (
            <p className="text-sm text-muted-foreground">
              Receipt {payment.receiptNumber} · {formatCurrency(payment.amount)} · {payment.mode}
              {payment.transactionNumber ? ` · Txn ${payment.transactionNumber}` : ""}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (notYetSubmitted) {
    return (
      <p className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
        Submit the application (Review & Submit step) before collecting payment.
      </p>
    );
  }

  if (!form.planId) {
    return (
      <p className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
        Select a membership plan on the Membership step first — the fee is pre-filled from the plan.
      </p>
    );
  }

  return (
    <div className="max-w-sm space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <PayOnlineButton
          memberId={memberId}
          onError={setError}
          className="flex-1 bg-brand-green hover:bg-brand-green/90"
        />
        <SharePaymentLinkButton memberId={memberId} memberName={member?.fullName} className="flex-1" />
      </div>

      {onlineAvailable && !showManualForm ? (
        <button
          type="button"
          onClick={() => setShowManualForm(true)}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-brand-green-dark hover:underline"
        >
          Record an offline payment instead
        </button>
      ) : (
        <form className="space-y-4 border-t border-border pt-4" onSubmit={handleCollect}>
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Amount (₹)</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <NativeSelect
            id="payment-mode"
            label="Payment mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as PaymentMode)}
            options={PAYMENT_MODES.map((m) => ({ value: m, label: m[0] + m.slice(1).toLowerCase() }))}
          />
          {mode !== "CASH" && (
            <div className="space-y-1.5">
              <Label htmlFor="payment-transaction-number">Transaction number</Label>
              <Input
                id="payment-transaction-number"
                placeholder="UPI/bank reference"
                value={transactionNumber}
                onChange={(e) => setTransactionNumber(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="payment-remarks">Remarks (optional)</Label>
            <Input id="payment-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={recordPayment.isPending} className="bg-brand-green hover:bg-brand-green/90">
            <Wallet className="size-4" />
            {recordPayment.isPending ? "Recording…" : "Collect Payment"}
          </Button>
        </form>
      )}
    </div>
  );
}
