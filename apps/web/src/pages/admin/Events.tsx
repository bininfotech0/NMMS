import { useMemo, useState } from "react";
import { Plus, Pencil, Users2, Trash2, UserPlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import {
  useCreateEvent,
  useEventRegistrations,
  useEvents,
  useEvidenceFileUrl,
  useRegisterMember,
  useReviewEvidence,
  useSetAttendance,
  useUnregisterMember,
  useUpdateEvent,
} from "@/hooks/useEvents";
import { useMembers } from "@/hooks/useMembers";
import { useAuthStore } from "@/stores/auth";
import { Role, type EventRegistrationResponse, type EventResponse, type EventStatus, type PlanTier } from "@nmms/shared";

const REWARD_TIERS: PlanTier[] = ["SILVER", "GOLD", "PLATINUM"];

const CAN_MANAGE = [Role.SUPER_ADMIN, Role.ADMIN];
const EVENT_STATUSES: EventStatus[] = ["PLANNED", "COMPLETED", "CANCELLED"];

const STATUS_STYLES: Record<EventStatus, string> = {
  PLANNED: "bg-sky-100 text-sky-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the browser's local time.
function toDatetimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Events() {
  const [editing, setEditing] = useState<EventResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [managingEvent, setManagingEvent] = useState<EventResponse | null>(null);

  const user = useAuthStore((state) => state.user);
  const canManage = !!user && CAN_MANAGE.includes(user.role);
  const { data: events = [], isLoading, isError } = useEvents();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(event: EventResponse) {
    setEditing(event);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">{events.length} events scheduled</p>
        </div>
        {canManage && (
          <Button className="bg-brand-green hover:bg-brand-green/90" onClick={openCreate}>
            <Plus />
            Create Event
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registrations</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={6} />}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-destructive">
                  Failed to load events.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell className="text-muted-foreground">{event.location ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDateTime(event.startAt)}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent font-medium", STATUS_STYLES[event.status])}>
                      {event.status[0] + event.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.registrationCount}
                    {event.capacity ? ` / ${event.capacity}` : ""}
                    {event.attendedCount > 0 ? ` · ${event.attendedCount} attended` : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setManagingEvent(event)}>
                        <Users2 className="size-4" />
                        Manage
                      </Button>
                      {canManage && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(event)}>
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && !isError && events.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No events scheduled yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <EventSheet key={editing?.id ?? "new"} event={editing} open={sheetOpen} onOpenChange={setSheetOpen} />
      )}
      <RegistrationsSheet
        key={managingEvent?.id ?? "none"}
        event={managingEvent}
        canManage={canManage}
        onOpenChange={(open) => !open && setManagingEvent(null)}
      />
    </div>
  );
}

function EventSheet({
  event,
  open,
  onOpenChange,
}: {
  event: EventResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = event !== null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startAt, setStartAt] = useState(toDatetimeLocal(event?.startAt));
  const [endAt, setEndAt] = useState(toDatetimeLocal(event?.endAt));
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : "");
  const [status, setStatus] = useState<EventStatus>(event?.status ?? "PLANNED");
  const [targetDescription, setTargetDescription] = useState(event?.targetDescription ?? "");
  const [targetQuantity, setTargetQuantity] = useState(event?.targetQuantity ? String(event.targetQuantity) : "");
  const [pointsReward, setPointsReward] = useState(event ? String(event.pointsReward) : "0");
  const [tierOverrides, setTierOverrides] = useState<Record<PlanTier, string>>(() => ({
    SILVER: event?.tierRewardOverrides.SILVER != null ? String(event.tierRewardOverrides.SILVER) : "",
    GOLD: event?.tierRewardOverrides.GOLD != null ? String(event.tierRewardOverrides.GOLD) : "",
    PLATINUM: event?.tierRewardOverrides.PLATINUM != null ? String(event.tierRewardOverrides.PLATINUM) : "",
  }));
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const isPending = createEvent.isPending || updateEvent.isPending;

  function reset() {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartAt("");
    setEndAt("");
    setCapacity("");
    setStatus("PLANNED");
    setTargetDescription("");
    setTargetQuantity("");
    setPointsReward("0");
    setTierOverrides({ SILVER: "", GOLD: "", PLATINUM: "" });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const tierRewardOverrideEntries = REWARD_TIERS.filter((tier) => tierOverrides[tier] !== "").map(
        (tier) => [tier, Number(tierOverrides[tier])] as const,
      );
      const payload = {
        title,
        description: description || null,
        location: location || null,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        capacity: capacity ? Number(capacity) : null,
        targetDescription: targetDescription || null,
        targetQuantity: targetQuantity ? Number(targetQuantity) : null,
        pointsReward: pointsReward ? Number(pointsReward) : 0,
        // On create, only sent when at least one tier field has a value (no
        // point syncing an empty rule set for a brand-new event). On edit,
        // always sent — the fields are pre-filled from the event's current
        // overrides, so this also correctly persists the admin explicitly
        // clearing all three back to "use base points reward."
        ...(isEdit || tierRewardOverrideEntries.length > 0
          ? { tierRewardOverrides: Object.fromEntries(tierRewardOverrideEntries) }
          : {}),
      };
      if (isEdit) {
        await updateEvent.mutateAsync({ id: event.id, dto: { ...payload, status } });
      } else {
        await createEvent.mutateAsync(payload);
      }
      reset();
      onOpenChange(false);
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
          <SheetTitle>{isEdit ? "Edit Event" : "Create Event"}</SheetTitle>
          <SheetDescription>
            {isEdit ? `Editing ${event.title}.` : "Schedule a new event for members."}
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location ?? ""} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startAt">Starts at</Label>
            <Input
              id="startAt"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endAt">Ends at (optional)</Label>
            <Input id="endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacity (optional)</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              step="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Completion target (optional) — members can submit evidence toward this and earn points
            </p>
            <Label htmlFor="targetDescription">Target description</Label>
            <Input
              id="targetDescription"
              placeholder="e.g. Plant 100 saplings"
              value={targetDescription}
              onChange={(e) => setTargetDescription(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="targetQuantity">Target quantity</Label>
                <Input
                  id="targetQuantity"
                  type="number"
                  min="1"
                  step="1"
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pointsReward">Points reward</Label>
                <Input
                  id="pointsReward"
                  type="number"
                  min="0"
                  step="1"
                  value={pointsReward}
                  onChange={(e) => setPointsReward(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <Label>Reward points by plan tier (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Leave blank to use the base points reward above for that tier.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {REWARD_TIERS.map((tier) => (
                  <div key={tier} className="space-y-1.5">
                    <Label htmlFor={`tier-${tier}`} className="text-xs font-normal text-muted-foreground">
                      {tier.charAt(0) + tier.slice(1).toLowerCase()}
                    </Label>
                    <Input
                      id={`tier-${tier}`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder={pointsReward || "0"}
                      value={tierOverrides[tier]}
                      onChange={(e) => setTierOverrides((prev) => ({ ...prev, [tier]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className={selectClass}
              >
                {EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0] + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending} className="bg-brand-green hover:bg-brand-green/90">
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Event"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function RegistrationsSheet({
  event,
  canManage,
  onOpenChange,
}: {
  event: EventResponse | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const eventId = event?.id ?? null;
  const { data: registrations = [], isLoading } = useEventRegistrations(eventId);
  const { data: members = [] } = useMembers();
  const registerMember = useRegisterMember(eventId ?? "");
  const setAttendance = useSetAttendance(eventId ?? "");
  const unregisterMember = useUnregisterMember(eventId ?? "");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unregisterTarget, setUnregisterTarget] = useState<EventRegistrationResponse | null>(null);

  const registeredIds = useMemo(() => new Set(registrations.map((r) => r.memberId)), [registrations]);
  const availableMembers = useMemo(
    () => members.filter((m) => !registeredIds.has(m.id)),
    [members, registeredIds],
  );
  const hasTarget =
    !!event &&
    (!!event.targetDescription ||
      !!event.targetQuantity ||
      event.pointsReward > 0 ||
      Object.keys(event.tierRewardOverrides ?? {}).length > 0);

  async function handleRegister() {
    if (!selectedMemberId) return;
    setError(null);
    try {
      await registerMember.mutateAsync(selectedMemberId);
      setSelectedMemberId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet open={event !== null} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{event?.title ?? "Registrations"}</SheetTitle>
          <SheetDescription>
            {event ? `${registrations.length} registered${event.capacity ? ` of ${event.capacity}` : ""}.` : null}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {canManage && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="add-member">Register a member</Label>
                <select
                  id="add-member"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select a member</option>
                  {availableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.mobile})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                disabled={!selectedMemberId || registerMember.isPending}
                onClick={handleRegister}
                className="bg-brand-green hover:bg-brand-green/90"
              >
                <UserPlus className="size-4" />
                Add
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {hasTarget && (event?.targetDescription || event?.targetQuantity) && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">Target</p>
              <p className="text-muted-foreground">
                {event?.targetDescription}
                {event?.targetQuantity ? ` (goal: ${event.targetQuantity})` : ""}
                {event && event.pointsReward > 0
                  ? ` — ${event.pointsReward} pts on approval${
                      event.tierRewardOverrides && Object.keys(event.tierRewardOverrides).length > 0
                        ? " (varies by plan tier)"
                        : ""
                    }`
                  : ""}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Attended</TableHead>
                  {hasTarget && <TableHead>Evidence</TableHead>}
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableSkeleton columns={hasTarget ? 4 : 3} rows={3} />}
                {!isLoading &&
                  registrations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.memberName}</div>
                        <div className="text-xs text-muted-foreground">{r.memberMobile}</div>
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <Button
                            size="sm"
                            variant={r.attended ? "default" : "outline"}
                            className={r.attended ? "bg-brand-green hover:bg-brand-green/90" : ""}
                            disabled={setAttendance.isPending}
                            onClick={() =>
                              setAttendance.mutate({ registrationId: r.id, attended: !r.attended })
                            }
                          >
                            {r.attended && <Check className="size-4" />}
                            {r.attended ? "Present" : "Mark present"}
                          </Button>
                        ) : (
                          <Badge variant="outline" className="border-transparent bg-muted font-medium">
                            {r.attended ? "Present" : "Not marked"}
                          </Badge>
                        )}
                      </TableCell>
                      {hasTarget && (
                        <TableCell>
                          <EvidenceCell eventId={eventId} registration={r} canManage={canManage} />
                        </TableCell>
                      )}
                      {canManage && (
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setUnregisterTarget(r)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                {!isLoading && registrations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={hasTarget ? 4 : 3} className="py-6 text-center text-muted-foreground">
                      No one registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
      <ConfirmDialog
        open={unregisterTarget !== null}
        onOpenChange={(open) => !open && setUnregisterTarget(null)}
        title="Remove this registration?"
        description={
          unregisterTarget
            ? `${unregisterTarget.memberName} will be unregistered from ${event?.title ?? "this event"}.`
            : ""
        }
        confirmLabel="Remove"
        isPending={unregisterMember.isPending}
        onConfirm={() => {
          if (!unregisterTarget) return;
          unregisterMember.mutate(unregisterTarget.id, {
            onSuccess: () => setUnregisterTarget(null),
          });
        }}
      />
    </Sheet>
  );
}

const COMPLETION_STYLES: Record<string, string> = {
  NOT_SUBMITTED: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

function EvidenceCell({
  eventId,
  registration,
  canManage,
}: {
  eventId: string | null;
  registration: EventRegistrationResponse;
  canManage: boolean;
}) {
  const [viewing, setViewing] = useState(false);
  const fileUrl = useEvidenceFileUrl(viewing ? eventId : null, viewing ? registration.id : null);
  const reviewEvidence = useReviewEvidence(eventId ?? "");

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Badge className={cn("border-transparent font-medium", COMPLETION_STYLES[registration.completionStatus])}>
        {registration.completionStatus.replace(/_/g, " ")}
      </Badge>
      {registration.completionStatus !== "NOT_SUBMITTED" && (
        <>
          {registration.evidenceNote && (
            <p className="max-w-48 text-xs text-muted-foreground">{registration.evidenceNote}</p>
          )}
          {registration.quantityAchieved !== null && (
            <p className="text-xs text-muted-foreground">Achieved: {registration.quantityAchieved}</p>
          )}
          {registration.evidenceFileName && !fileUrl && (
            <button
              type="button"
              className="text-xs font-medium text-brand-green hover:underline"
              onClick={() => setViewing(true)}
            >
              View evidence
            </button>
          )}
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-green hover:underline">
              Open evidence file
            </a>
          )}
        </>
      )}
      {canManage && registration.completionStatus === "PENDING_REVIEW" && (
        <div className="flex gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="border-brand-green text-brand-green hover:bg-brand-green/10"
            disabled={reviewEvidence.isPending}
            onClick={() => reviewEvidence.mutate({ registrationId: registration.id, approved: true })}
          >
            <Check className="size-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={reviewEvidence.isPending}
            onClick={() => reviewEvidence.mutate({ registrationId: registration.id, approved: false })}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
