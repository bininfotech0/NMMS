import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMyDonations } from "@/hooks/useDonations";
import { useOrgProfile } from "@/hooks/useOrg";
import { DonationReceipt } from "@/components/receipts/DonationReceipt";

export function MemberDonationReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: member, isLoading: memberLoading } = useMyProfile();
  const { data: donations = [], isLoading: donationsLoading } = useMyDonations();
  const { data: org } = useOrgProfile();

  if (!id) return null;

  if (memberLoading || donationsLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading receipt...</p>;
  }

  const donation = donations.find((d) => d.id === id && d.status === "APPROVED");
  if (!member || !donation || !donation.receiptNumber) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Link
          to="/member/donations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Donations
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
          to="/member/donations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Donations
        </Link>
        <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / Save as PDF
        </Button>
      </div>

      <DonationReceipt
        org={org}
        data={{
          receiptNumber: donation.receiptNumber,
          memberName: member.fullName,
          membershipNumber: member.membershipNumber,
          amount: donation.amount,
          mode: donation.mode,
          reference: donation.reference,
          note: donation.note,
          donorAddress: donation.donorAddress,
          donorPan: donation.donorPan,
          pointsAwarded: donation.pointsAwarded,
          reviewedAt: donation.reviewedAt,
        }}
      />
    </div>
  );
}
