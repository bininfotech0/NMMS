import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VolunteerBatch } from "@nmms/shared";

const BATCH_STYLES: Record<VolunteerBatch, string> = {
  SILVER: "bg-slate-200 text-slate-700 border-slate-300",
  GOLD: "bg-amber-100 text-amber-800 border-amber-300",
  PLATINUM: "bg-violet-100 text-violet-800 border-violet-300",
};

export function VolunteerBatchBadge({ batch, className }: { batch: VolunteerBatch | null; className?: string }) {
  if (!batch) {
    return (
      <Badge variant="outline" className={className}>
        Not yet ranked
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(BATCH_STYLES[batch], className)}>
      {batch.charAt(0) + batch.slice(1).toLowerCase()}
    </Badge>
  );
}
