import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMember, useCardToken } from "@/hooks/useMembers";
import { useMemberDocuments, useDocumentImageUrl } from "@/hooks/useDocuments";
import { usePlans } from "@/hooks/usePlans";
import { useOrgProfile } from "@/hooks/useOrg";
import { computeVolunteerBatch } from "@/lib/volunteer-batch";
import { MembershipCardFront, MembershipCardBack, type CardDisplayData } from "@/components/cards/MembershipCard";

function formatDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberCard() {
  const { id } = useParams<{ id: string }>();
  const { data: member, isLoading } = useMember(id ?? null);
  const { data: cardToken } = useCardToken(id ?? null);
  const { data: documents = [] } = useMemberDocuments(id ?? null);
  const { data: plans = [] } = usePlans();
  const { data: org } = useOrgProfile();

  const photoDocId = documents.find((d) => d.type === "PHOTO")?.id ?? null;
  const photoUrl = useDocumentImageUrl(photoDocId);

  const qrValue = useMemo(
    () => (cardToken ? `${window.location.origin}/verify/${cardToken.token}` : ""),
    [cardToken],
  );

  if (!id) return null;

  if (isLoading || !member) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading member...</p>;
  }

  if (!member.membershipNumber) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          to={`/admin/members/${id}/profile`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Profile
        </Link>
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          A membership card is available once this member has been approved.
        </p>
      </div>
    );
  }

  const batch = org ? computeVolunteerBatch(member.referralPointsBalance, org) : null;

  const data: CardDisplayData = {
    fullName: member.fullName,
    planName: member.planName ?? plans.find((p) => p.id === member.planId)?.name ?? "—",
    membershipNumber: member.membershipNumber,
    mobile: member.mobile,
    joiningDate: formatDate(member.joiningDate),
    validUntil: member.validUntil ? formatDate(member.validUntil) : "Lifetime",
    volunteerBatch: batch ? `${batch.charAt(0)}${batch.slice(1).toLowerCase()}` : null,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={`/admin/members/${id}/profile`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to Profile
          </Link>
          <h1 className="font-heading text-2xl font-bold">Membership Card</h1>
        </div>
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
          <MembershipCardBack />
        </div>
      </div>
    </div>
  );
}
