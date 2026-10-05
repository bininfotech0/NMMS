import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMyCardToken } from "@/hooks/useMyCard";
import { useMyPhotoUrl } from "@/hooks/useMyDocuments";
import { useOrgContact } from "@/hooks/useOrgContact";
import { computeVolunteerBatch } from "@/lib/volunteer-batch";
import { MembershipCardFront, MembershipCardBack, type CardDisplayData } from "@/components/cards/MembershipCard";

function formatDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberIdCard() {
  const { data: member, isLoading } = useMyProfile();
  const { data: cardToken } = useMyCardToken();
  // Public org endpoint: the staff-only /org profile is not readable with a
  // member login, which left the card back blank.
  const { data: org } = useOrgContact();
  const photoUrl = useMyPhotoUrl();

  const qrValue = useMemo(
    () => (cardToken ? `${window.location.origin}/verify/${cardToken.token}` : ""),
    [cardToken],
  );

  if (isLoading || !member) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading your card…</p>;
  }

  if (!member.membershipNumber) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl font-bold">My membership card</h1>
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Your card will appear here as soon as your membership is active. Finish the steps on your Home page first.
        </p>
      </div>
    );
  }

  const batch = computeVolunteerBatch(member.planTier);

  const data: CardDisplayData = {
    fullName: member.fullName,
    planName: member.planName ?? "—",
    membershipNumber: member.membershipNumber,
    mobile: member.mobile,
    joiningDate: formatDate(member.joiningDate),
    validUntil: member.validUntil ? formatDate(member.validUntil) : "Lifetime",
    volunteerBatch: batch ? `${batch.charAt(0)}${batch.slice(1).toLowerCase()}` : null,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">My membership card</h1>
          <p className="text-sm text-muted-foreground">
            {member.validUntil ? `Valid until ${formatDate(member.validUntil)}` : "Lifetime membership — no end date"}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Button
            className="w-full bg-brand-green hover:bg-brand-green/90 sm:w-auto"
            disabled={!qrValue}
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Download / Print card
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">On a phone, choose "Save as PDF" to keep a copy.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 rounded-xl border border-border bg-card p-3 sm:p-6">
        <div>
          <p className="no-print mb-2 text-sm font-medium text-muted-foreground">Front</p>
          <MembershipCardFront data={data} qrValue={qrValue} photoUrl={photoUrl} />
        </div>
        <div>
          <p className="no-print mb-2 text-sm font-medium text-muted-foreground">Back</p>
          {org && <MembershipCardBack org={org} />}
        </div>
      </div>
    </div>
  );
}
