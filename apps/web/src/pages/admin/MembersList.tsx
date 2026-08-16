import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserPlus, Edit, IdCard, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { captureGeolocation, getOrCreateDeviceId, isOnline } from "@/lib/device";
import { useCreateMember, useDedupeCheck, useDeleteMember, useMembers } from "@/hooks/useMembers";
import type { DedupeMatch, MemberResponse, MemberStatus } from "@nmms/shared";

function describeDedupeMatch(match: DedupeMatch): string {
  if (match.matchedOn === "name") {
    return `This name is similar to an existing member: ${match.fullName} (${match.status}). Please confirm this isn't a duplicate.`;
  }
  return `This mobile number matches an existing member: ${match.fullName} (${match.status}).`;
}

const STATUS_FILTERS: ("All" | MemberStatus)[] = [
  "All",
  "DRAFT",
  "PAYMENT_COLLECTED",
  "SUBMITTED",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED",
  "DECEASED",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MembersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const [query, setQuery] = useState(initialSearch);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemberResponse | null>(null);

  const { data: members = [], isLoading, isError } = useMembers();
  const deleteMember = useDeleteMember();

  const filtered = useMemo(() => {
    return members.filter((member) => {
      const matchesStatus = status === "All" || member.status === status;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        q === "" ||
        member.fullName.toLowerCase().includes(q) ||
        member.mobile.includes(q) ||
        (member.membershipNumber?.toLowerCase().includes(q) ?? false) ||
        member.email?.toLowerCase().includes(q) ||
        false;
      return matchesStatus && matchesQuery;
    });
  }, [members, query, status]);

  const columns: DataGridColumn<MemberResponse>[] = useMemo(
    () => [
      {
        key: "fullName",
        header: "Member",
        sortable: true,
        searchable: true,
        render: (member) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand-bg-soft text-xs font-semibold text-brand-green">
                {initials(member.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="font-medium">{member.fullName}</span>
              {(member.membershipNumber || member.registrationNumber) && (
                <p className="text-xs text-muted-foreground">
                  {member.membershipNumber ?? member.registrationNumber}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "mobile",
        header: "Mobile",
        sortable: true,
      },
      {
        key: "planId",
        header: "Plan",
        sortable: true,
        render: (member) =>
          member.planName ? <span>{member.planName}</span> : <span className="text-muted-foreground">—</span>,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        filterable: true,
        render: (member) => <StatusBadge status={member.status} />,
      },
      {
        key: "createdAt",
        header: "Registered",
        sortable: true,
        render: (member) => (
          <span className="text-muted-foreground">
            {new Date(member.createdAt).toLocaleDateString("en-IN")}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">{members.length} members registered</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, mobile, or email..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatus(filter)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                status === filter
                  ? "bg-brand-green text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {filter === "All" ? "All" : filter[0] + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <Button className="bg-brand-green hover:bg-brand-green/90 shrink-0" onClick={() => setAddOpen(true)}>
          <UserPlus />
          Add Member
        </Button>
      </div>

      <DataGrid
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        isError={isError}
        errorMessage="Failed to load members."
        emptyMessage={query ? "No members match your search." : "No members registered yet."}
        rowKey={(m) => m.id}
        onRowClick={(member) =>
          navigate(
            member.status === "DRAFT" || member.status === "PAYMENT_COLLECTED"
              ? `/admin/members/${member.id}/wizard`
              : `/admin/members/${member.id}/profile`,
          )
        }
        searchable={false}
        compact
        stickyHeader
        pageSize={25}
        statusKey="status"
        quickActions={(member) => (
          <div className="flex gap-1 justify-end">
            {(member.status === "DRAFT" || member.status === "PAYMENT_COLLECTED") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/members/${member.id}/wizard`);
                }}
              >
                <Edit className="size-4" />
              </Button>
            )}
            {member.membershipNumber && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/members/${member.id}/card`);
                }}
              >
                <IdCard className="size-4" />
              </Button>
            )}
            {member.status === "DRAFT" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(member);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      />

      <AddMemberSheet open={addOpen} onOpenChange={setAddOpen} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete draft?"
        description={`This permanently deletes ${deleteTarget?.fullName ?? "this draft"} and any documents/nominee details saved so far. This cannot be undone.`}
        confirmLabel="Delete"
        isPending={deleteMember.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMember.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}

function AddMemberSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dedupeWarning, setDedupeWarning] = useState<string | null>(null);
  const createMember = useCreateMember();
  const dedupeCheck = useDedupeCheck();

  function reset() {
    setFullName("");
    setMobile("");
    setError(null);
    setDedupeWarning(null);
  }

  async function handleMobileBlur() {
    if (mobile.length < 10) return;
    const matches = await dedupeCheck.mutateAsync({ mobile, fullName: fullName || undefined });
    setDedupeWarning(matches.length > 0 ? describeDedupeMatch(matches[0]) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const location = await captureGeolocation();
      const created = await createMember.mutateAsync({
        fullName,
        mobile,
        registrationLatitude: location?.latitude ?? null,
        registrationLongitude: location?.longitude ?? null,
        deviceId: getOrCreateDeviceId(),
        registrationMode: isOnline() ? "ONLINE" : "OFFLINE",
        registeredAt: new Date(),
      });
      reset();
      onOpenChange(false);
      navigate(`/admin/members/${created.id}/wizard`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Member</SheetTitle>
          <SheetDescription>
            Start a new registration as a draft. The rest of the details can be filled in later.
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              onBlur={handleMobileBlur}
              required
            />
            {dedupeWarning && <p className="text-sm text-amber-600">{dedupeWarning}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={createMember.isPending}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {createMember.isPending ? "Creating…" : "Create Draft"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
