import { Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VolunteerBatchBadge, VolunteerBatchIcon } from "@/components/shared/VolunteerBatchBadge";
import { useMyReferralRewards } from "@/hooks/useReferrals";
import { useMyProfile } from "@/hooks/useMyProfile";
import { titleCase } from "@/lib/utils";
import { computeNextVolunteerBatch, computeVolunteerBatch } from "@/lib/volunteer-batch";

export function MemberRewards() {
  const { data: profile } = useMyProfile();
  const { data: rewards, isLoading } = useMyReferralRewards();
  // Derived from planTier (same source the dashboard's "Your plan" card
  // reads) rather than a separate referral-summary field — see MemberDashboard.
  const batch = computeVolunteerBatch(profile?.planTier ?? null);
  const nextBatch = computeNextVolunteerBatch(profile?.planTier ?? null);

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardContent className="flex items-center justify-between px-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Your progress</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Rewards earned</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !rewards || rewards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Gift className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Keep referring members to unlock your first reward.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rewards.map((reward) => (
                <li key={reward.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <VolunteerBatchBadge batch={reward.batch} />
                  </div>
                  <Badge variant={reward.status === "FULFILLED" ? "secondary" : "outline"}>
                    {reward.status === "FULFILLED" ? "Received" : "Pending"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
