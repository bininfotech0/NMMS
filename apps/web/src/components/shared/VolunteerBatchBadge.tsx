import { Award, Medal, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, titleCase } from "@/lib/utils";
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
      {titleCase(batch)}
    </Badge>
  );
}

// Icon + tile color for each batch, lowest to highest tier — same three
// colors as BATCH_STYLES above, just as a solid tile rather than a badge.
const BATCH_ICONS: Record<VolunteerBatch, { icon: LucideIcon; tileClassName: string }> = {
  SILVER: { icon: Medal, tileClassName: "bg-slate-200 text-slate-700" },
  GOLD: { icon: Award, tileClassName: "bg-amber-100 text-amber-800" },
  PLATINUM: { icon: Trophy, tileClassName: "bg-violet-100 text-violet-800" },
};

export function VolunteerBatchIcon({ batch, className }: { batch: VolunteerBatch | null; className?: string }) {
  const { icon: Icon, tileClassName } = batch ? BATCH_ICONS[batch] : { icon: Award, tileClassName: "bg-brand-gold/15 text-brand-gold" };
  return (
    <div className={cn("flex size-10 items-center justify-center rounded-lg", tileClassName, className)}>
      <Icon className="size-5" />
    </div>
  );
}
