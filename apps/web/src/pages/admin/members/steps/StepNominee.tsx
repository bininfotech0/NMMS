import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepProps } from "../wizard-types";

export function StepNominee({ form, setForm }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-heading text-sm font-semibold">Emergency Contact</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
              value={form.emergencyContactName}
              onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactMobile">Mobile</Label>
            <Input
              id="emergencyContactMobile"
              value={form.emergencyContactMobile}
              onChange={(e) => setForm((f) => ({ ...f, emergencyContactMobile: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input
              id="emergencyContactRelationship"
              value={form.emergencyContactRelationship}
              onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelationship: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-heading text-sm font-semibold">Nominee</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nomineeName">Name</Label>
            <Input
              id="nomineeName"
              value={form.nomineeName}
              onChange={(e) => setForm((f) => ({ ...f, nomineeName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nomineeRelationship">Relationship</Label>
            <Input
              id="nomineeRelationship"
              value={form.nomineeRelationship}
              onChange={(e) => setForm((f) => ({ ...f, nomineeRelationship: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nomineeDob">Date of birth</Label>
            <Input
              id="nomineeDob"
              type="date"
              value={form.nomineeDob}
              onChange={(e) => setForm((f) => ({ ...f, nomineeDob: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nomineeMobile">Mobile</Label>
            <Input
              id="nomineeMobile"
              value={form.nomineeMobile}
              onChange={(e) => setForm((f) => ({ ...f, nomineeMobile: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nomineeAddress">Address</Label>
            <Input
              id="nomineeAddress"
              value={form.nomineeAddress}
              onChange={(e) => setForm((f) => ({ ...f, nomineeAddress: e.target.value }))}
            />
          </div>
        </div>
        {!form.nomineeName &&
        (form.nomineeRelationship || form.nomineeDob || form.nomineeAddress || form.nomineeMobile) ? (
          <p className="mt-2 text-xs text-destructive">
            Nominee name is required to save these details — the other fields you've entered here won't be saved
            until you add a name.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            A nominee name is required to save nominee details; leave it blank to skip.
          </p>
        )}
      </div>
    </div>
  );
}
