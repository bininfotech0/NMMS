import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { useMyPayments } from "@/hooks/useMyPayments";
import { titleCase } from "@/lib/utils";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberPayments() {
  const { data: payments = [], isLoading } = useMyPayments();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-bold">Payments</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading payments...</p>
      ) : payments.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No payments recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-bg-soft text-brand-green-dark">
                <Receipt className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {formatCurrency(payment.amount)} · {titleCase(payment.mode)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Receipt {payment.receiptNumber} · {formatDate(payment.paidAt)}
                </p>
              </div>
              <Link
                to={`/member/payments/${payment.id}/receipt`}
                className="text-sm font-medium text-brand-green hover:underline"
              >
                View Receipt
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
