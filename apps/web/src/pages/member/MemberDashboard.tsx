import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Copy, CreditCard, Loader2, Share2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VolunteerBatchBadge, VolunteerBatchIcon } from "@/components/shared/VolunteerBatchBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MemberCompleteRegistration, PayMembershipFee } from "@/pages/member/MemberCompleteRegistration";
import { ContactUs } from "@/components/member/ContactUs";
import { LatestNoticeBanner } from "@/pages/member/MemberNotices";
import { isMemberActive, memberStatusInfo } from "@/lib/member-status";
import { useMyReferralSummary } from "@/hooks/useReferrals";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMemberAuthStore } from "@/stores/member-auth";
import { titleCase } from "@/lib/utils";
import { computeNextVolunteerBatch, computeVolunteerBatch } from "@/lib/volunteer-batch";

const SHARE_MESSAGE = "Join our membership program using my referral link:";

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(d: string | Date): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function PageLoading() {
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading your page…
    </p>
  );
}

export function MemberDashboard() {
  // The store only holds the login-time snapshot, refreshed at most every 15
  // minutes (access-token expiry) — falling back to it just avoids a flash
  // of empty content before this query resolves. Prefer `profile` (always
  // refetched on mount) so a plan change made by staff shows up here.
  const storeMember = useMemberAuthStore((state) => state.member);
  const { data: profile } = useMyProfile();
  const member = profile ?? storeMember;
  const { data: summary, isLoading } = useMyReferralSummary();
  // Derived from the same planTier shown in the "Your plan" card above
  // (rather than summary.batch/nextBatch from a separate request) so the two
  // can never show a stale/inconsistent pairing after a plan upgrade.
  const batch = computeVolunteerBatch(member?.planTier ?? null);
  const nextBatch = computeNextVolunteerBatch(member?.planTier ?? null);

  const referralLink = summary?.referralCode
    ? `${window.location.origin}/join?ref=${summary.referralCode}`
    : null;

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  }

  async function shareLink() {
    if (!referralLink) return;
    // Native share sheet where the browser supports it (most phones) — falls
    // back to opening a pre-filled WhatsApp chat, since that's how referral
    // links get passed around in practice.
    if (navigator.share) {
      try {
        await navigator.share({ text: SHARE_MESSAGE, url: referralLink });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error("Couldn't open the share sheet");
        }
      }
      return;
    }
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${SHARE_MESSAGE} ${referralLink}`)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  if (!isMemberActive(member?.status)) {
    // A self-registered member starts DRAFT with no plan at all (unlike the
    // staff wizard) — guide them through finishing it themselves.
    // AWAITING_PAYMENT means the form is done and only payment (which
    // auto-activates) remains.
    if (member?.status === "DRAFT" || member?.status === "AWAITING_PAYMENT") {
      // Needs the full MemberResponse (addressLine, planId, etc.), not the
      // narrower login-time AuthMember snapshot storeMember falls back to.
      if (!profile) {
        return <PageLoading />;
      }
      return (
        <div className="space-y-4">
          <LatestNoticeBanner />
          <MemberCompleteRegistration member={profile} />
        </div>
      );
    }

    const info = memberStatusInfo(member?.status);
    if (member?.status === "EXPIRED") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Your membership has ended
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {profile?.validUntil ? `It ended on ${formatDate(profile.validUntil)}. ` : ""}
              Renew now to become an active member again. It only takes a minute.
            </p>
            {profile ? <PayMembershipFee member={profile} buttonLabel="Renew now (UPI / Card)" /> : <PageLoading />}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{info.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{info.guidance}</p>
          <ContactUs />
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !summary) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-4">
      <LatestNoticeBanner />
      <MyMembershipCard
        statusLabel={memberStatusInfo(member?.status).label}
        planName={member?.planName ?? null}
        validUntil={profile?.validUntil ?? null}
        membershipNumber={profile?.membershipNumber ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Invite friends and earn points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="flex-1 truncate text-sm">{referralLink}</span>
            <Button variant="ghost" size="sm" onClick={copyLink}>
              <Copy className="mr-1.5 size-4" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={shareLink}>
              <Share2 className="mr-1.5 size-4" />
              Share
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send this link to friends on WhatsApp. When they join using it, you get points.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-3 py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <p className="text-sm text-muted-foreground">Your points</p>
              <p className="mt-1 text-3xl font-bold text-brand-green">{summary.pointsBalance}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
              <Wallet className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Your volunteer batch</p>
              <VolunteerBatchBadge batch={batch} />
              {nextBatch && (
                <p className="text-xs text-muted-foreground">
                  Upgrade to {titleCase(nextBatch)} membership to reach the next batch
                </p>
              )}
            </div>
            <VolunteerBatchIcon batch={batch} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>People you referred ({summary.referrals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.referrals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Users className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No one has joined through your link yet — share it to start earning points.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {summary.referrals.map((referral) => (
                <li key={referral.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{referral.fullName}</span>
                  <StatusBadge status={referral.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MyMembershipCard({
  statusLabel,
  planName,
  validUntil,
  membershipNumber,
}: {
  statusLabel: string;
  planName: string | null;
  validUntil: string | Date | null;
  membershipNumber: string | null;
}) {
  const daysLeft = validUntil ? daysUntil(validUntil) : null;
  const endingSoon = daysLeft !== null && daysLeft <= 30;

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">My membership</p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-brand-green-dark">
              <CheckCircle2 className="size-5 text-brand-green" />
              {statusLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {planName && <span className="font-medium text-foreground">{planName}</span>}
              {planName && " · "}
              {validUntil ? `Valid until ${formatDate(validUntil)}` : "Lifetime membership"}
            </p>
            {membershipNumber && <p className="text-xs text-muted-foreground">Member number: {membershipNumber}</p>}
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
            <CreditCard className="size-5" />
          </div>
        </div>
        {endingSoon && (
          <p className="rounded-lg bg-brand-gold/15 px-3 py-2 text-sm text-brand-brown">
            Your membership ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}. You can renew it here once it ends.
          </p>
        )}
        <Button asChild className="w-full bg-brand-green hover:bg-brand-green/90 sm:w-auto">
          <Link to="/member/card">
            <CreditCard className="size-4" />
            View my membership card
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
