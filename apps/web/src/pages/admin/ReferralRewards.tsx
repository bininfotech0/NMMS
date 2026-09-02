import { useMemo, useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { useFulfillReward, useReferralRewards } from "@/hooks/useReferrals";
import type { ReferralRewardResponse, RewardStatus } from "@nmms/shared";

const TABS: { label: string; value: RewardStatus | undefined }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Fulfilled", value: "FULFILLED" },
  { label: "All", value: undefined },
];

export function ReferralRewards() {
  const [status, setStatus] = useState<RewardStatus | undefined>("PENDING");
  const { data: rewards = [], isLoading, isError } = useReferralRewards(status);
  const fulfillReward = useFulfillReward();

  const columns: DataGridColumn<ReferralRewardResponse>[] = useMemo(
    () => [
      { key: "memberName", header: "Member", sortable: true, cellClass: "font-medium" },
      { key: "batch", header: "Batch reached", render: (reward) => <VolunteerBatchBadge batch={reward.batch} /> },
      {
        key: "pointsAtEarn",
        header: "Points at earn",
        sortable: true,
        render: (reward) => <span className="text-muted-foreground">{reward.pointsAtEarn}</span>,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (reward) => (
          <Badge variant={reward.status === "FULFILLED" ? "secondary" : "outline"}>
            {reward.status === "FULFILLED" ? "Fulfilled" : "Pending"}
          </Badge>
        ),
      },
      {
        key: "createdAt",
        header: "Earned",
        sortable: true,
        render: (reward) => (
          <span className="text-muted-foreground">{new Date(reward.createdAt).toLocaleDateString()}</span>
        ),
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      rewards.map((reward) => ({
        memberName: reward.memberName,
        batch: reward.batch,
        pointsAtEarn: reward.pointsAtEarn,
        status: reward.status,
        earnedAt: new Date(reward.createdAt).toLocaleDateString(),
      })),
    [rewards],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Referral Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Bonuses and gifts earned by members through the referral program
          </p>
        </div>
        <ExportCsvButton filename="referral-rewards.csv" rows={exportRows} />
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

      <DataGrid
        columns={columns}
        data={rewards}
        isLoading={isLoading}
        isError={isError}
        preserveOrder
        errorMessage="Failed to load rewards."
        emptyMessage="No rewards found."
        rowKey={(reward) => reward.id}
        searchable
        searchPlaceholder="Search by member name..."
        searchKeys={["memberName"]}
        pageSize={25}
        quickActions={(reward) =>
          reward.status === "PENDING" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={fulfillReward.isPending}
              onClick={() => fulfillReward.mutate({ id: reward.id })}
            >
              <Gift className="size-4" />
              Mark Fulfilled
            </Button>
          ) : null
        }
      />
    </div>
  );
}
