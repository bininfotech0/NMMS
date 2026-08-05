import { Logo } from "@/components/brand/Logo";
import type { OrgProfile } from "@nmms/shared";

export interface ReceiptDisplayData {
  receiptNumber: string;
  memberName: string;
  membershipNumber: string | null;
  amount: number;
  mode: string;
  transactionNumber: string | null;
  remarks: string | null;
  paidAt: string | Date;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Printable via window.print() — same pattern as MembershipCard, no PDF
// library involved.
export function PaymentReceipt({ org, data }: { org: OrgProfile | undefined; data: ReceiptDisplayData }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-white p-8 text-sm text-foreground">
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <Logo variant="icon" size={32} />
        <div>
          <p className="font-heading text-lg font-bold text-brand-green-dark">{org?.name ?? "Organization"}</p>
          {org?.address && <p className="text-xs text-muted-foreground">{org.address}</p>}
          {(org?.contactEmail || org?.contactPhone) && (
            <p className="text-xs text-muted-foreground">
              {[org?.contactEmail, org?.contactPhone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <h2 className="mb-4 text-center font-heading text-base font-semibold uppercase tracking-wide">
        Payment Receipt
      </h2>

      <div className="space-y-2">
        <Row label="Receipt No." value={data.receiptNumber} />
        <Row label="Date" value={formatDate(data.paidAt)} />
        <Row label="Member" value={data.memberName} />
        {data.membershipNumber && <Row label="Membership No." value={data.membershipNumber} />}
        <Row label="Payment Mode" value={data.mode[0] + data.mode.slice(1).toLowerCase()} />
        {data.transactionNumber && <Row label="Transaction No." value={data.transactionNumber} />}
        {data.remarks && <Row label="Remarks" value={data.remarks} />}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg bg-brand-bg-soft px-4 py-3">
        <span className="font-medium">Amount Paid</span>
        <span className="text-lg font-bold text-brand-green-dark">{formatCurrency(data.amount)}</span>
      </div>

      {(org?.bankAccountName || org?.bankAccountNumber) && (
        <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Bank Details</p>
          {org?.bankAccountName && <p>Account Name: {org.bankAccountName}</p>}
          {org?.bankAccountNumber && <p>Account No.: {org.bankAccountNumber}</p>}
          {org?.bankIfscCode && <p>IFSC: {org.bankIfscCode}</p>}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        This is a system-generated receipt and does not require a signature.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
