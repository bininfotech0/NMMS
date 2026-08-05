import { useState } from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMember } from "@/hooks/useMembers";
import { useSearchReferrer } from "@/hooks/useReferrals";

// Replaces a flat "every member in the org" dropdown with a name/referral-code
// typeahead — the same field a staff member uses to credit a referrer while
// registering someone in person.
export function ReferrerField({
  value,
  onChange,
  excludeMemberId,
}: {
  value: string;
  onChange: (memberId: string) => void;
  excludeMemberId?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useSearchReferrer(query);
  const { data: selected } = useMember(value || null);

  const options = results.filter((r) => r.id !== excludeMemberId);

  return (
    <div className="relative space-y-1.5">
      <Label htmlFor="referralMemberId">Referred by (optional)</Label>
      {value && selected ? (
        <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
          <span>
            {selected.fullName}
            {selected.referralCode && <span className="ml-1.5 text-muted-foreground">({selected.referralCode})</span>}
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear referrer"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div>
          <Input
            id="referralMemberId"
            placeholder="Search by name or referral code"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && query.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-border bg-card shadow-md">
              {options.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
              ) : (
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onMouseDown={() => {
                      onChange(option.id);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check className="size-3.5 shrink-0 opacity-0" />
                    <span className="flex-1 truncate">{option.fullName}</span>
                    {option.referralCode && (
                      <span className="text-xs text-muted-foreground">{option.referralCode}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
