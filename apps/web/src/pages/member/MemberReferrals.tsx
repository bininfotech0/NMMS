import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useMyReferralSummary } from "@/hooks/useReferrals";

export function MemberReferrals() {
  const { data: summary, isLoading } = useMyReferralSummary();

  if (isLoading || !summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>People you referred ({summary.referrals.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.referrals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Users className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No one has joined through your link yet — share it from your dashboard to start earning points.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td className="whitespace-nowrap py-2.5">{referral.fullName}</td>
                    <td className="whitespace-nowrap py-2.5">
                      <StatusBadge status={referral.status} />
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-muted-foreground">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
