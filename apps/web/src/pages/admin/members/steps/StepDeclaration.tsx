import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepProps } from "../wizard-types";

const DECLARATIONS: {
  key: "declarationInfoCorrect" | "declarationAcceptConstitution" | "declarationAcceptPrivacyPolicy" | "declarationAcceptTerms";
  label: string;
}[] = [
  { key: "declarationInfoCorrect", label: "I declare that the information provided is correct." },
  { key: "declarationAcceptConstitution", label: "I accept the organization's constitution." },
  { key: "declarationAcceptPrivacyPolicy", label: "I accept the privacy policy." },
  { key: "declarationAcceptTerms", label: "I accept the terms & conditions." },
];

export function StepDeclaration({ form, setForm }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {DECLARATIONS.map((d) => (
          <label key={d.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-input"
              checked={form[d.key]}
              onChange={(e) => setForm((f) => ({ ...f, [d.key]: e.target.checked }))}
            />
            {d.label}
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="declarationPlace">Place</Label>
          <Input
            id="declarationPlace"
            value={form.declarationPlace}
            onChange={(e) => setForm((f) => ({ ...f, declarationPlace: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="declarationDate">Date</Label>
          <Input
            id="declarationDate"
            type="date"
            value={form.declarationDate}
            onChange={(e) => setForm((f) => ({ ...f, declarationDate: e.target.value }))}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The applicant's signature, uploaded in Step 7 (Identity &amp; Documents), serves as the signature
        for this declaration. The registering field executive is recorded automatically against this
        application for the audit trail.
      </p>
    </div>
  );
}
