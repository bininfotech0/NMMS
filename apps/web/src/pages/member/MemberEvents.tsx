import { useRef, useState } from "react";
import { Calendar, MapPin, Target, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyEvents, useRegisterForEventSelf, useSubmitEventEvidence } from "@/hooks/useEvents";
import type { MyEventSummary } from "@nmms/shared";

const COMPLETION_STYLES: Record<string, string> = {
  NOT_SUBMITTED: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

const COMPLETION_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberEvents() {
  const { data: events = [], isLoading } = useMyEvents();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No events are open right now — check back later.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventCard key={event.eventId} event={event} />
      ))}
    </div>
  );
}

function EventCard({ event }: { event: MyEventSummary }) {
  const register = useRegisterForEventSelf();
  const hasTarget = !!event.targetDescription || !!event.targetQuantity || event.pointsReward > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{event.title}</span>
          {event.registered && event.completionStatus && (
            <Badge className={COMPLETION_STYLES[event.completionStatus]} variant="outline">
              {COMPLETION_LABELS[event.completionStatus]}
              {event.completionStatus === "APPROVED" && event.pointsReward > 0
                ? ` — +${event.pointsReward} points`
                : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(event.startAt)}
            {event.endAt ? ` – ${formatDate(event.endAt)}` : ""}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {event.location}
            </span>
          )}
        </div>

        {hasTarget && (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-2.5 text-xs">
            <Target className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
            <div>
              {event.targetDescription && <p className="font-medium">{event.targetDescription}</p>}
              {event.targetQuantity != null && (
                <p className="text-muted-foreground">Target: {event.targetQuantity}</p>
              )}
              {event.pointsReward > 0 && (
                <p className="text-muted-foreground">Reward: {event.pointsReward} points on approval</p>
              )}
            </div>
          </div>
        )}

        {event.status === "CANCELLED" && (
          <p className="text-xs text-destructive">This event has been cancelled.</p>
        )}

        {!event.registered && event.status === "PLANNED" && (
          <Button
            size="sm"
            className="bg-brand-green hover:bg-brand-green/90"
            disabled={register.isPending}
            onClick={() => register.mutate(event.eventId)}
          >
            Register
          </Button>
        )}

        {!event.registered && event.status === "COMPLETED" && (
          <p className="text-xs text-muted-foreground">This event has already concluded.</p>
        )}

        {event.registered && hasTarget && event.registrationId && event.status !== "CANCELLED" && (
          <>
            {event.completionStatus === "REJECTED" && event.reviewNote && (
              <p className="text-xs text-destructive">Reason: {event.reviewNote}</p>
            )}
            {(event.completionStatus === "NOT_SUBMITTED" || event.completionStatus === "REJECTED") && (
              <EvidenceForm eventId={event.eventId} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceForm({ eventId }: { eventId: string }) {
  const [note, setNote] = useState("");
  const [quantityAchieved, setQuantityAchieved] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitEvidence = useSubmitEventEvidence();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitEvidence.mutateAsync({
      eventId,
      note: note || undefined,
      quantityAchieved: quantityAchieved ? Number(quantityAchieved) : undefined,
      file: file ?? undefined,
    });
    setNote("");
    setQuantityAchieved("");
    setFile(null);
  }

  return (
    <form className="space-y-2 rounded-lg border border-border p-3" onSubmit={handleSubmit}>
      <p className="text-xs font-medium">Submit your evidence</p>
      <div className="space-y-1.5">
        <Label htmlFor={`note-${eventId}`}>Note</Label>
        <textarea
          id={`note-${eventId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Describe what you completed"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`quantity-${eventId}`}>Quantity achieved (optional)</Label>
        <Input
          id={`quantity-${eventId}`}
          type="number"
          min={0}
          value={quantityAchieved}
          onChange={(e) => setQuantityAchieved(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-4" />
          {file ? file.name : "Attach photo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        className="bg-brand-green hover:bg-brand-green/90"
        disabled={submitEvidence.isPending || (!note && !file)}
      >
        {submitEvidence.isPending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
