import { useMemo, useState } from "react";
import { Check, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { ApiError } from "@/lib/api-client";
import { useApplicationsQueue, useApproveApplication, useRejectApplication } from "@/hooks/useApplications";
import { useClaimMember, useUnclaimedReferrals } from "@/hooks/useMembers";
import { useAuthStore } from "@/stores/auth";
import { Role, type MemberResponse } from "@nmms/shared";

// ADMIN/SUPER_ADMIN approve or reject anything. A FIELD_EXECUTIVE can too,
// but only a self-registered member they've personally claimed (see the
// Unclaimed Referrals section below) — the backend enforces this; this is
// just the matching UI gate so the buttons only appear when they'd succeed.
const CAN_APPROVE_ANY = [Role.ADMIN, Role.SUPER_ADMIN];
const CAN_CLAIM = [Role.FIELD_EXECUTIVE, Role.ADMIN, Role.SUPER_ADMIN];

function canReviewMember(role: Role | undefined, member: MemberResponse): boolean {
  if (!role) return false;
  if (CAN_APPROVE_ANY.includes(role)) return true;
  return role === Role.FIELD_EXECUTIVE && member.selfRegistered;
}

export function Applications() {
  const [rejectTarget, setRejectTarget] = useState<MemberResponse | null>(null);

  const user = useAuthStore((state) => state.user);
  const { data: queue = [], isLoading, isError, error } = useApplicationsQueue();

  const approve = useApproveApplication();

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
            {queue.length} application{queue.length === 1 ? "" : "s"} awaiting review
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
        errorMessage={forbidden ? "You don't have permission to review applications." : "Failed to load applications."}
        emptyMessage="No applications to review."
        rowKey={(m) => m.id}
        searchable
        searchPlaceholder="Search by name or mobile..."
        searchKeys={["fullName", "mobile"]}
        statusKey="status"
        pageSize={25}
        quickActions={(member) => {
          const canApprove = member.status === "SUBMITTED" && canReviewMember(user?.role, member);
          const canReject = canApprove;
          return (
            <div className="flex justify-end gap-2">
              {canApprove && (
                <Button
                  size="sm"
                  className="bg-brand-green hover:bg-brand-green/90"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(member.id)}
                >
                  <Check className="size-4" />
                  Approve
                </Button>
              )}
              {canReject && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRejectTarget(member)}
                >
                  <X className="size-4" />
                  Reject
                </Button>
              )}
            </div>
          );
        }}
      />

      <RejectSheet member={rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} />
    </div>
  );
}

// Self-registrations via a member's referral link (/join?ref=...), waiting
// for a Field Executive to confirm them in person before payment collection
// and approval proceed. Claiming reassigns the member to the claiming staff
// user, after which it behaves like any other field-executive-created member.
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

function RejectSheet({
  member,
  onOpenChange,
}: {
  member: MemberResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reject = useRejectApplication();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setError(null);
    try {
      await reject.mutateAsync({ memberId: member.id, remarks });
      setRemarks("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet open={member !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Reject Application</SheetTitle>
          <SheetDescription>
            {member ? `Rejecting ${member.fullName}'s application. This cannot be undone.` : null}
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="remarks">Reason for rejection</Label>
            <Input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" variant="destructive" disabled={reject.isPending}>
              {reject.isPending ? "Rejecting…" : "Reject Application"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
