import { useState } from "react";
import { Check, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Applications</h1>
        <p className="text-sm text-muted-foreground">
          {queue.length} application{queue.length === 1 ? "" : "s"} awaiting review
        </p>
      </div>

      {canClaim && <UnclaimedReferralsCard />}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={5} />}
            {forbidden && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  You don't have permission to review applications.
                </TableCell>
              </TableRow>
            )}
            {isError && !forbidden && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-destructive">
                  Failed to load applications.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              queue.map((member) => {
                const canApprove = member.status === "SUBMITTED" && canReviewMember(user?.role, member);
                const canReject = canApprove;

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{member.mobile}</TableCell>
                    <TableCell>
                      <StatusBadge status={member.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                );
              })}
            {!isLoading && !isError && queue.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No applications to review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
