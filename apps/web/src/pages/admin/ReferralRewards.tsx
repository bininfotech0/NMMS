import { useMemo } from "react";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { useReferralRewards } from "@/hooks/useReferrals";
import type { ReferralRewardResponse } from "@nmms/shared";

export function ReferralRewards() {
  const { data: rewards = [], isLoading, isError } = useReferralRewards();

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
            Rewards are recorded automatically when members reach a qualifying tier.
          </p>
        </div>
        <ExportCsvButton filename="referral-rewards.csv" rows={exportRows} />
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
      />
    </div>
  );
}
