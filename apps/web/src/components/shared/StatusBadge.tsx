import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-brand-green/10 text-brand-green border-transparent",
  Pending: "bg-brand-gold/15 text-brand-brown border-transparent",
  Expired: "bg-destructive/10 text-destructive border-transparent",

  // Member lifecycle statuses (see @nmms/shared memberStatusSchema)
  DRAFT: "bg-muted text-muted-foreground border-transparent",
  AWAITING_PAYMENT: "bg-brand-gold/15 text-brand-brown border-transparent",
  // Legacy statuses, retired from the active form-first/payment-last flow.
  PAYMENT_COLLECTED: "bg-blue-500/10 text-blue-700 border-transparent",
  SUBMITTED: "bg-brand-gold/15 text-brand-brown border-transparent",
  // Legacy status, retired from the active one-level approval flow.
  VERIFIED: "bg-blue-500/10 text-blue-700 border-transparent",
  APPROVED: "bg-brand-green/10 text-brand-green border-transparent",
  ACTIVE: "bg-brand-green/10 text-brand-green border-transparent",
  REJECTED: "bg-destructive/10 text-destructive border-transparent",
  SUSPENDED: "bg-destructive/10 text-destructive border-transparent",
  EXPIRED: "bg-destructive/10 text-destructive border-transparent",
  RENEWED: "bg-brand-green/10 text-brand-green border-transparent",
  DECEASED: "bg-muted text-muted-foreground border-transparent",
};

function toTitleCase(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status] ?? "")}>
      {toTitleCase(status)}
    </Badge>
  );
}
