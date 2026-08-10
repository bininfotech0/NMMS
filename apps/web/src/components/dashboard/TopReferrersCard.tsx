import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { useReferralLeaderboard } from "@/hooks/useReferrals";

export function TopReferrersCard() {
  const { data: leaderboard = [], isLoading } = useReferralLeaderboard();

  if (!isLoading && leaderboard.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Top Referrers</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-border">
            {leaderboard.map((entry, i) => (
              <li key={entry.memberId} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <Link to={`/admin/members/${entry.memberId}/profile`} className="font-medium hover:underline">
                    {entry.fullName}
                  </Link>
                  <VolunteerBatchBadge batch={entry.batch} />
                </div>
                <div className="text-right">
                  <p className="font-medium">{entry.pointsBalance} pts</p>
                  <p className="text-xs text-muted-foreground">{entry.referralCount} referred</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
