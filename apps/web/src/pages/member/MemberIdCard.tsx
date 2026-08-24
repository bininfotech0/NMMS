import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMyCardToken } from "@/hooks/useMyCard";
import { useMyPhotoUrl } from "@/hooks/useMyDocuments";
import { useOrgProfile } from "@/hooks/useOrg";
import { computeVolunteerBatch } from "@/lib/volunteer-batch";
import { MembershipCardFront, MembershipCardBack, type CardDisplayData } from "@/components/cards/MembershipCard";

function formatDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberIdCard() {
  const { data: member, isLoading } = useMyProfile();
  const { data: cardToken } = useMyCardToken();
  const { data: org } = useOrgProfile();
  const photoUrl = useMyPhotoUrl();

  const qrValue = useMemo(
    () => (cardToken ? `${window.location.origin}/verify/${cardToken.token}` : ""),
    [cardToken],
  );

  if (isLoading || !member) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading your card...</p>;
  }

  if (!member.membershipNumber) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl font-bold">ID Card</h1>
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Your membership card will be available here once your membership is approved.
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
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">ID Card</h1>
        <Button
          className="bg-brand-green hover:bg-brand-green/90"
          disabled={!qrValue}
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="flex flex-wrap gap-8 rounded-xl border border-border bg-card p-6">
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
