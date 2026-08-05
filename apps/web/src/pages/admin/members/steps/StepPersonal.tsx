import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLookups } from "@/hooks/useLookups";
import type { StepProps } from "../wizard-types";

export function StepPersonal({ form, setForm }: StepProps) {
  const { data: familyTypes = [] } = useLookups("FAMILY_TYPE");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fatherName">Father's name</Label>
          <Input
            id="fatherName"
            value={form.fatherName}
            onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="motherName">Mother's name</Label>
          <Input
            id="motherName"
            value={form.motherName}
            onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spouseOrGuardianName">Spouse / guardian name</Label>
          <Input
            id="spouseOrGuardianName"
            value={form.spouseOrGuardianName}
            onChange={(e) => setForm((f) => ({ ...f, spouseOrGuardianName: e.target.value }))}
          />
        </div>
        <NativeSelect
          id="familyTypeId"
          label="Family type"
          placeholder="Select family type"
          value={form.familyTypeId}
          onChange={(e) => setForm((f) => ({ ...f, familyTypeId: e.target.value }))}
          options={familyTypes.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.value }))}
        />
        <div className="space-y-1.5">
          <Label htmlFor="familyMembersCount">Family members count</Label>
          <Input
            id="familyMembersCount"
            type="number"
            min="0"
            step="1"
            value={form.familyMembersCount}
            onChange={(e) => setForm((f) => ({ ...f, familyMembersCount: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="childrenCount">Children count</Label>
          <Input
            id="childrenCount"
            type="number"
            min="0"
            step="1"
            value={form.childrenCount}
            onChange={(e) => setForm((f) => ({ ...f, childrenCount: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monthlyIncome">Monthly income</Label>
          <Input
            id="monthlyIncome"
            type="number"
            min="0"
            step="0.01"
            value={form.monthlyIncome}
            onChange={(e) => setForm((f) => ({ ...f, monthlyIncome: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={form.isDifferentlyAbled}
            onChange={(e) => setForm((f) => ({ ...f, isDifferentlyAbled: e.target.checked }))}
          />
          Differently abled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={form.isExServiceman}
            onChange={(e) => setForm((f) => ({ ...f, isExServiceman: e.target.checked }))}
          />
          Ex-serviceman
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={form.isSeniorCitizen}
            onChange={(e) => setForm((f) => ({ ...f, isSeniorCitizen: e.target.checked }))}
          />
          Senior citizen
        </label>
      </div>
    </div>
  );
}
