import { Copy, CreditCard, Share2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VolunteerBatchBadge, VolunteerBatchIcon } from "@/components/shared/VolunteerBatchBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MemberCompleteRegistration } from "@/pages/member/MemberCompleteRegistration";
import { useMyReferralSummary } from "@/hooks/useReferrals";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMemberAuthStore } from "@/stores/member-auth";
import { titleCase } from "@/lib/utils";
import { computeNextVolunteerBatch, computeVolunteerBatch } from "@/lib/volunteer-batch";

const SHARE_MESSAGE = "Join our membership program using my referral link:";

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

  if (member?.status !== "ACTIVE") {
    // A self-registered member starts DRAFT with no plan at all (unlike the
    // staff wizard) — guide them through finishing it themselves instead of
    // the generic "pending" message, which only applies once there's
    // actually nothing left for the member to do but wait. AWAITING_PAYMENT
    // means the form is done and only payment (which auto-activates) remains.
    if (member?.status === "DRAFT" || member?.status === "AWAITING_PAYMENT") {
      // Needs the full MemberResponse (addressLine, planId, etc.), not the
      // narrower login-time AuthMember snapshot storeMember falls back to.
      if (!profile) {
        return <p className="text-sm text-muted-foreground">Loading…</p>;
      }
      return <MemberCompleteRegistration member={profile} />;
    }

    const lapsed = member?.status === "EXPIRED" || member?.status === "RENEWED";
    return (
      <Card>
        <CardHeader>
          <CardTitle>{lapsed ? "Membership needs renewal" : "Registration pending review"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your membership status is currently <span className="font-medium">{member?.status}</span>.{" "}
            {lapsed
              ? "Contact your field executive to renew your plan and regain full access."
              : "Contact your field executive to finish your registration — once it's active, you'll get your own referral link and can start earning points."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {member?.planName && (
        <Card className="gap-3 py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <p className="text-sm text-muted-foreground">Your plan</p>
              <p className="mt-1 text-lg font-semibold">
                {member.planName}
                {member.planTier && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({member.planTier.charAt(0)}
                    {member.planTier.slice(1).toLowerCase()})
                  </span>
                )}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
              <CreditCard className="size-5" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your referral link</CardTitle>
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
            Share this link — anyone who joins through it is automatically credited to you.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-3 py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <p className="text-sm text-muted-foreground">Points balance</p>
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
