import { Award, Copy, Share2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/shared/RankBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useMyReferralSummary } from "@/hooks/useReferrals";
import { useMemberAuthStore } from "@/stores/member-auth";

const SHARE_MESSAGE = "Join our membership program using my referral link:";

export function MemberDashboard() {
  const member = useMemberAuthStore((state) => state.member);
  const { data: summary, isLoading } = useMyReferralSummary();

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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registration pending review</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your membership application is currently <span className="font-medium">{member?.status}</span>.
            Once staff approve it, you'll get your own referral link and can start earning points.
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
              <p className="text-sm text-muted-foreground">Your rank</p>
              <RankBadge rank={summary.rank} />
              {summary.nextRank && (
                <p className="text-xs text-muted-foreground">
                  {summary.pointsToNextRank} points to {summary.nextRank}
                </p>
              )}
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold">
              <Award className="size-5" />
            </div>
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
