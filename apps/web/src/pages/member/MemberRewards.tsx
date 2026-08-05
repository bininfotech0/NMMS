import { Award, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RankBadge } from "@/components/shared/RankBadge";
import { useMyReferralRewards, useMyReferralSummary } from "@/hooks/useReferrals";

export function MemberRewards() {
  const { data: summary } = useMyReferralSummary();
  const { data: rewards, isLoading } = useMyReferralRewards();

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardContent className="flex items-center justify-between px-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Your progress</p>
            <RankBadge rank={summary?.rank ?? null} />
            {summary?.nextRank && (
              <p className="text-xs text-muted-foreground">
                {summary.pointsToNextRank} more points to reach {summary.nextRank}
              </p>
            )}
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold">
            <Award className="size-5" />
          </div>
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
                    <RankBadge rank={reward.rank} />
                    <span className="text-muted-foreground">at {reward.pointsAtEarn} points</span>
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
