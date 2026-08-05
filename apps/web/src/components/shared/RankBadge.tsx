import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReferralRank } from "@nmms/shared";

const RANK_STYLES: Record<ReferralRank, string> = {
  SILVER: "bg-slate-200 text-slate-700 border-slate-300",
  GOLD: "bg-amber-100 text-amber-800 border-amber-300",
  PLATINUM: "bg-violet-100 text-violet-800 border-violet-300",
};

export function RankBadge({ rank, className }: { rank: ReferralRank | null; className?: string }) {
  if (!rank) {
    return (
      <Badge variant="outline" className={className}>
        Not yet ranked
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(RANK_STYLES[rank], className)}>
      {rank.charAt(0) + rank.slice(1).toLowerCase()}
    </Badge>
  );
}
