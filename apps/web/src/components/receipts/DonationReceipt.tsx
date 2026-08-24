import { Logo } from "@/components/brand/Logo";
import type { OrgProfile } from "@nmms/shared";

export interface DonationReceiptDisplayData {
  receiptNumber: string;
  memberName: string;
  membershipNumber: string | null;
  amount: number;
  mode: string;
  reference: string | null;
  note: string | null;
  donorAddress: string | null;
  donorPan: string | null;
  pointsAwarded: number | null;
  reviewedAt: string | Date | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Printable via window.print() — same pattern as PaymentReceipt/MembershipCard,
// no PDF library involved.
export function DonationReceipt({ org, data }: { org: OrgProfile | undefined; data: DonationReceiptDisplayData }) {
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
        Donation Receipt
      </h2>

      <div className="space-y-2">
        <Row label="Receipt No." value={data.receiptNumber} />
        {data.reviewedAt && <Row label="Date" value={formatDate(data.reviewedAt)} />}
        <Row label="Donor" value={data.memberName} />
        {data.membershipNumber && <Row label="Membership No." value={data.membershipNumber} />}
        <Row label="Mode" value={data.mode[0] + data.mode.slice(1).toLowerCase()} />
        {data.reference && <Row label="Reference" value={data.reference} />}
        {data.donorAddress && <Row label="Address" value={data.donorAddress} />}
        {data.donorPan && <Row label="PAN" value={data.donorPan} />}
        {data.note && <Row label="Note" value={data.note} />}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg bg-brand-bg-soft px-4 py-3">
        <span className="font-medium">Amount Donated</span>
        <span className="text-lg font-bold text-brand-green-dark">{formatCurrency(data.amount)}</span>
      </div>

      {data.pointsAwarded != null && data.pointsAwarded > 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {data.pointsAwarded} reward points credited to your wallet
        </p>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        This is a system-generated receipt and does not require a signature. Thank you for your generosity.
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
