import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface NativeSelectOption {
  value: string;
  label: string;
}

export interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  placeholder?: string;
  options: NativeSelectOption[];
}

// Thin wrapper around a native <select> matching the styling every page in
// this app already duplicates inline (no shadcn Select primitive is used
// anywhere) — bundles the Label + error-text pattern too, since the wizard
// introduces ~15-20 new select fields that would otherwise repeat it all.
export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ label, error, placeholder, options, id, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <Label htmlFor={id}>{label}</Label>}
        <select
          ref={ref}
          id={id}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            error && "border-destructive",
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  },
);
NativeSelect.displayName = "NativeSelect";
