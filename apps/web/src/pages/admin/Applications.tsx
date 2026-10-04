import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { ApiError } from "@/lib/api-client";
import { useApplicationsQueue } from "@/hooks/useApplications";
import { useClaimMember, useUnclaimedReferrals } from "@/hooks/useMembers";
import { useAuthStore } from "@/stores/auth";
import { Role, type MemberResponse } from "@nmms/shared";

// The queue is for payment follow-up; payment activates registrations automatically.
const CAN_CLAIM = [Role.FIELD_EXECUTIVE, Role.ADMIN, Role.SUPER_ADMIN];

export function Applications() {
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const { data: queue = [], isLoading, isError, error } = useApplicationsQueue();

  const forbidden = isError && error instanceof ApiError && error.status === 403;
  const canClaim = !!user && CAN_CLAIM.includes(user.role);

  const columns: DataGridColumn<MemberResponse>[] = useMemo(
    () => [
      { key: "fullName", header: "Member", sortable: true, cellClass: "font-medium" },
      { key: "mobile", header: "Mobile", sortable: true },
      { key: "status", header: "Status", sortable: true },
      {
        key: "createdAt",
        header: "Last Updated",
        sortable: true,
        render: (member) => (
          <span className="text-muted-foreground">{new Date(member.createdAt).toLocaleDateString()}</span>
        ),
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      queue.map((m) => ({
        fullName: m.fullName,
        mobile: m.mobile,
        status: m.status,
        lastUpdated: new Date(m.createdAt).toLocaleDateString(),
      })),
    [queue],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Applications</h1>
          <p className="text-sm text-muted-foreground">
            {queue.length} registration{queue.length === 1 ? "" : "s"} awaiting payment
          </p>
        </div>
        <ExportCsvButton filename="applications.csv" rows={exportRows} />
      </div>

      {canClaim && <UnclaimedReferralsCard />}

      <DataGrid
        columns={columns}
        data={queue}
        isLoading={isLoading}
        isError={isError}
        errorMessage={forbidden ? "You don't have permission to view applications." : "Failed to load applications."}
        emptyMessage="No registrations awaiting payment."
        rowKey={(m) => m.id}
        onRowClick={(member) => navigate(`/admin/members/${member.id}/profile`)}
        searchable
        searchPlaceholder="Search by name or mobile..."
        searchKeys={["fullName", "mobile"]}
        statusKey="status"
        pageSize={25}
      />

    </div>
  );
}

// Self-registrations via a member's referral link (/join?ref=...), waiting
// for a Field Executive to confirm them in person before the registration
// proceeds. Claiming reassigns the member to the claiming staff user, after
// which it behaves like any other field-executive-created member.
function UnclaimedReferralsCard() {
  const { data: unclaimed = [], isLoading } = useUnclaimedReferrals();
  const claim = useClaimMember();

  if (!isLoading && unclaimed.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Unclaimed Referral Sign-ups ({unclaimed.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-border">
            {unclaimed.map((member) => (
              <li key={member.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground">{member.mobile}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={claim.isPending}
                  onClick={() => claim.mutate(member.id)}
                >
                  <UserCheck className="size-4" />
                  Claim & Confirm
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

