import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-bg-soft text-brand-green">
          <Icon className="size-7" />
        </div>
        <div className="max-w-sm space-y-1">
          <h2 className="font-heading text-lg font-semibold">Coming soon</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
