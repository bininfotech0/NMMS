import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMember, useMemberPayments } from "@/hooks/useMembers";
import { useOrgProfile } from "@/hooks/useOrg";
import { PaymentReceipt } from "@/components/receipts/PaymentReceipt";

export function PaymentReceiptPage() {
  const { id, paymentId } = useParams<{ id: string; paymentId: string }>();
  const { data: member, isLoading: memberLoading } = useMember(id ?? null);
  const { data: payments = [], isLoading: paymentsLoading } = useMemberPayments(id ?? null);
  const { data: org } = useOrgProfile();

  if (!id || !paymentId) return null;

  if (memberLoading || paymentsLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading receipt...</p>;
  }

  const payment = payments.find((p) => p.id === paymentId);
  if (!member || !payment) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Link
          to={`/admin/members/${id}/profile`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Profile
        </Link>
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Receipt not found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/admin/members/${id}/profile`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Profile
        </Link>
        <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / Save as PDF
        </Button>
      </div>

      <PaymentReceipt
        org={org}
        data={{
          receiptNumber: payment.receiptNumber,
          memberName: member.fullName,
          membershipNumber: member.membershipNumber,
          amount: payment.amount,
          mode: payment.mode,
          transactionNumber: payment.transactionNumber,
          remarks: payment.remarks,
          paidAt: payment.paidAt,
        }}
      />
    </div>
  );
}
