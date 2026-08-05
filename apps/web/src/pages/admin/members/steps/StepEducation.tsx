import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLookups } from "@/hooks/useLookups";
import type { StepProps } from "../wizard-types";

export function StepEducation({ form, setForm }: StepProps) {
  const { data: educationLevels = [] } = useLookups("EDUCATION");
  const { data: occupations = [] } = useLookups("OCCUPATION");
  const { data: businessTypes = [] } = useLookups("BUSINESS_TYPE");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NativeSelect
        id="educationId"
        label="Education"
        placeholder="Select education level"
        value={form.educationId}
        onChange={(e) => setForm((f) => ({ ...f, educationId: e.target.value }))}
        options={educationLevels.filter((e) => e.isActive).map((e) => ({ value: e.id, label: e.value }))}
      />
      <div className="space-y-1.5">
        <Label htmlFor="qualificationDetail">Qualification detail</Label>
        <Input
          id="qualificationDetail"
          placeholder="e.g. B.Tech Computer Science"
          value={form.qualificationDetail}
          onChange={(e) => setForm((f) => ({ ...f, qualificationDetail: e.target.value }))}
        />
      </div>
      <NativeSelect
        id="occupationId"
        label="Occupation"
        placeholder="Select occupation"
        value={form.occupationId}
        onChange={(e) => setForm((f) => ({ ...f, occupationId: e.target.value }))}
        options={occupations.filter((o) => o.isActive).map((o) => ({ value: o.id, label: o.value }))}
      />
      <NativeSelect
        id="businessTypeId"
        label="Business type (if self-employed)"
        placeholder="Select business type"
        value={form.businessTypeId}
        onChange={(e) => setForm((f) => ({ ...f, businessTypeId: e.target.value }))}
        options={businessTypes.filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.value }))}
      />
      <div className="space-y-1.5">
        <Label htmlFor="languagesKnown">Languages known</Label>
        <Input
          id="languagesKnown"
          placeholder="Comma-separated, e.g. Hindi, English"
          value={form.languagesKnown}
          onChange={(e) => setForm((f) => ({ ...f, languagesKnown: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skills">Skills</Label>
        <Input
          id="skills"
          placeholder="Comma-separated, e.g. Teaching, First Aid"
          value={form.skills}
          onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
        />
      </div>
    </div>
  );
}
