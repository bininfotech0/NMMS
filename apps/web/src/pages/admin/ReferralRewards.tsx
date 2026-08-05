import { useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RankBadge } from "@/components/shared/RankBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useFulfillReward, useReferralRewards } from "@/hooks/useReferrals";
import type { RewardStatus } from "@nmms/shared";

const TABS: { label: string; value: RewardStatus | undefined }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Fulfilled", value: "FULFILLED" },
  { label: "All", value: undefined },
];

export function ReferralRewards() {
  const [status, setStatus] = useState<RewardStatus | undefined>("PENDING");
  const { data: rewards = [], isLoading, isError } = useReferralRewards(status);
  const fulfillReward = useFulfillReward();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Referral Rewards</h1>
        <p className="text-sm text-muted-foreground">
          Bonuses and gifts earned by members through the referral program
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatus(tab.value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              status === tab.value
                ? "border-brand-green text-brand-green"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Rank reached</TableHead>
              <TableHead>Points at earn</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Earned</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={6} />}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-destructive">
                  Failed to load rewards.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              rewards.map((reward) => (
                <TableRow key={reward.id}>
                  <TableCell className="font-medium">{reward.memberName}</TableCell>
                  <TableCell>
                    <RankBadge rank={reward.rank} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{reward.pointsAtEarn}</TableCell>
                  <TableCell>
                    <Badge variant={reward.status === "FULFILLED" ? "secondary" : "outline"}>
                      {reward.status === "FULFILLED" ? "Fulfilled" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(reward.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {reward.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={fulfillReward.isPending}
                          onClick={() => fulfillReward.mutate({ id: reward.id })}
                        >
                          <Gift className="size-4" />
                          Mark Fulfilled
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && !isError && rewards.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No rewards found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
