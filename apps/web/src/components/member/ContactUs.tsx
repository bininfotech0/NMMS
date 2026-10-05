import { Mail, Phone } from "lucide-react";
import { useOrgContact } from "@/hooks/useOrgContact";
import { cn } from "@/lib/utils";

// "Need help?" block with tap-to-call / tap-to-email links. Shown wherever a
// member is told to contact the organization, so it's never a dead end.
export function ContactUs({ className, title = "Need help? Contact us" }: { className?: string; title?: string }) {
  const { data: org } = useOrgContact();
  const hasContact = !!org && (!!org.contactPhone || !!org.contactEmail);

  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 p-3 text-sm", className)}>
      <p className="font-medium">{title}</p>
      {!hasContact && (
        <p className="mt-1 text-muted-foreground">Please visit or call the {org?.name ?? "NGO"} office.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {org?.contactPhone && (
          <a href={`tel:${org.contactPhone}`} className="inline-flex items-center gap-1.5 text-brand-green hover:underline">
            <Phone className="size-4" />
            {org.contactPhone}
          </a>
        )}
        {org?.contactEmail && (
          <a href={`mailto:${org.contactEmail}`} className="inline-flex items-center gap-1.5 text-brand-green hover:underline">
            <Mail className="size-4" />
            {org.contactEmail}
          </a>
        )}
      </div>
    </div>
  );
}
