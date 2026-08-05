import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLookups } from "@/hooks/useLookups";
import { composeFullName, type StepProps } from "../wizard-types";

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const MARITAL_STATUS_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "DIVORCED", label: "Divorced" },
];

export function StepBasicInfo({ form, setForm }: StepProps) {
  const { data: religions = [] } = useLookups("RELIGION");
  const { data: casteCategories = [] } = useLookups("CASTE_CATEGORY");

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Upload a passport-style photo in the Identity &amp; Documents step (Step 6).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Mr, Mrs, Dr"
            value={form.title}
            onChange={(e) =>
              setForm((f) => {
                const title = e.target.value;
                return { ...f, title, fullName: composeFullName({ ...f, title }) };
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={form.firstName}
            onChange={(e) =>
              setForm((f) => {
                const firstName = e.target.value;
                return { ...f, firstName, fullName: composeFullName({ ...f, firstName }) };
              })
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="middleName">Middle name</Label>
          <Input
            id="middleName"
            value={form.middleName}
            onChange={(e) =>
              setForm((f) => {
                const middleName = e.target.value;
                return { ...f, middleName, fullName: composeFullName({ ...f, middleName }) };
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(e) =>
              setForm((f) => {
                const lastName = e.target.value;
                return { ...f, lastName, fullName: composeFullName({ ...f, lastName }) };
              })
            }
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={form.fullName} readOnly disabled className="bg-muted" />
        </div>
        <NativeSelect
          id="gender"
          label="Gender"
          placeholder="Select gender"
          value={form.gender}
          onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
          options={GENDER_OPTIONS}
        />
        <div className="space-y-1.5">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            type="date"
            value={form.dob}
            onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
          />
        </div>
        <NativeSelect
          id="maritalStatus"
          label="Marital status"
          placeholder="Select status"
          value={form.maritalStatus}
          onChange={(e) => setForm((f) => ({ ...f, maritalStatus: e.target.value }))}
          options={MARITAL_STATUS_OPTIONS}
        />
        <div className="space-y-1.5">
          <Label htmlFor="bloodGroup">Blood group</Label>
          <Input
            id="bloodGroup"
            placeholder="e.g. O+"
            value={form.bloodGroup}
            onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            placeholder="e.g. Indian"
            value={form.nationality}
            onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
          />
        </div>
        <NativeSelect
          id="religionId"
          label="Religion"
          placeholder="Select religion"
          value={form.religionId}
          onChange={(e) => setForm((f) => ({ ...f, religionId: e.target.value }))}
          options={religions.filter((r) => r.isActive).map((r) => ({ value: r.id, label: r.value }))}
        />
        <NativeSelect
          id="casteCategoryId"
          label="Caste category"
          placeholder="Select caste category"
          value={form.casteCategoryId}
          onChange={(e) => setForm((f) => ({ ...f, casteCategoryId: e.target.value }))}
          options={casteCategories.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.value }))}
        />
      </div>
    </div>
  );
}
