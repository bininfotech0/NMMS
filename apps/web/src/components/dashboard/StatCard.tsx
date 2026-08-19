import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  trend: string;
  trendUp?: boolean;
  icon: LucideIcon;
  accent?: "green" | "gold" | "brown" | "muted";
}

const ACCENTS = {
  green: "bg-brand-green/10 text-brand-green",
  gold: "bg-brand-gold/15 text-brand-gold",
  brown: "bg-brand-brown/10 text-brand-brown",
  muted: "bg-muted text-muted-foreground",
};

export function StatCard({ label, value, trend, trendUp = true, icon: Icon, accent = "green" }: StatCardProps) {
  return (
    <Card className="gap-3 py-4 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between px-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
          <div
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-xs font-medium",
              trendUp ? "text-brand-green" : "text-destructive"
            )}
          >
            {trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend}
          </div>
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg", ACCENTS[accent])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
