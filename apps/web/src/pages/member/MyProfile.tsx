import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AddressFields } from "@/pages/admin/members/AddressFields";
import { ApiError } from "@/lib/api-client";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useMyProfile";
import { useMyAllLookups } from "@/hooks/useLookups";
import type { LookupResponse, MemberResponse, MemberSelfUpdateInput } from "@nmms/shared";

// Active values are shown as normal choices; if the member's current selection
// was since deactivated, it's kept in the list (appended, so it doesn't shift
// active options' order) so the <select> doesn't silently blank it out.
function selectableOptions(lookups: LookupResponse[], selectedId: string) {
  const active = lookups.filter((l) => l.isActive);
  const options = active.map((l) => ({ value: l.id, label: l.value }));
  if (selectedId && !active.some((l) => l.id === selectedId)) {
    const selected = lookups.find((l) => l.id === selectedId);
    if (selected) options.push({ value: selected.id, label: selected.value });
  }
  return options;
}

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

interface ProfileFormState {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  // The fullName as it was loaded — used as the compose fallback so a legacy
  // member who only has a single fullName (no first/middle/last parts) never
  // sees it collapse to just the title they're editing.
  originalFullName: string;

  // True when the member already had decomposed name parts at load time.
  // Only members in this bucket get fullName auto-recomposed as they edit
  // title/first/middle/last — for a legacy member with only a single
  // fullName string, editing one of these fields must not overwrite the
  // fuller name that isn't represented in the parts at all.
  hasNameParts: boolean;
  gender: string;
  dob: string;
  maritalStatus: string;
  bloodGroup: string;
  nationality: string;
  religionId: string;
  casteCategoryId: string;

  fatherName: string;
  motherName: string;
  spouseOrGuardianName: string;
  familyTypeId: string;
  familyMembersCount: string;
  childrenCount: string;
  monthlyIncome: string;
  isDifferentlyAbled: boolean;
  isExServiceman: boolean;
  isSeniorCitizen: boolean;

  whatsappNumber: string;
  email: string;
  socialMediaLinks: string;
  pincode: string;
  addressLine: string;
  landmark: string;
  latitude: string;
  longitude: string;
  sameAsCurrentAddress: boolean;
  permPincode: string;
  permAddressLine: string;
  permLandmark: string;

  educationId: string;
  occupationId: string;
  qualificationDetail: string;
  businessTypeId: string;
  languagesKnown: string;
  skills: string;

  emergencyContactName: string;
  emergencyContactMobile: string;
  emergencyContactRelationship: string;
}

function dateToInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function inputToDate(s: string): Date | null {
  return s ? new Date(s) : null;
}

function numberToInput(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

function inputToNumber(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function tagsToInput(tags: string[]): string {
  return tags.join(", ");
}

function inputToTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function composeFullName(
  parts: { title: string; firstName: string; middleName: string; lastName: string },
  fallback: string,
): string {
  return (
    [parts.title, parts.firstName, parts.middleName, parts.lastName]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(" ") || fallback
  );
}

function memberToForm(member: MemberResponse): ProfileFormState {
  return {
    title: member.title ?? "",
    firstName: member.firstName ?? "",
    middleName: member.middleName ?? "",
    lastName: member.lastName ?? "",
    fullName: member.fullName,
    originalFullName: member.fullName,
    hasNameParts: !!(member.firstName || member.middleName || member.lastName),
    gender: member.gender ?? "",
    dob: dateToInput(member.dob),
    maritalStatus: member.maritalStatus ?? "",
    bloodGroup: member.bloodGroup ?? "",
    nationality: member.nationality ?? "",
    religionId: member.religionId ?? "",
    casteCategoryId: member.casteCategoryId ?? "",

    fatherName: member.fatherName ?? "",
    motherName: member.motherName ?? "",
    spouseOrGuardianName: member.spouseOrGuardianName ?? "",
    familyTypeId: member.familyTypeId ?? "",
    familyMembersCount: numberToInput(member.familyMembersCount),
    childrenCount: numberToInput(member.childrenCount),
    monthlyIncome: numberToInput(member.monthlyIncome),
    isDifferentlyAbled: member.isDifferentlyAbled,
    isExServiceman: member.isExServiceman,
    isSeniorCitizen: member.isSeniorCitizen,

    whatsappNumber: member.whatsappNumber ?? "",
    email: member.email ?? "",
    socialMediaLinks: member.socialMediaLinks ?? "",
    pincode: member.pincode ?? "",
    addressLine: member.addressLine ?? "",
    landmark: member.landmark ?? "",
    latitude: numberToInput(member.latitude),
    longitude: numberToInput(member.longitude),
    sameAsCurrentAddress: member.sameAsCurrentAddress,
    permPincode: member.permPincode ?? "",
    permAddressLine: member.permAddressLine ?? "",
    permLandmark: member.permLandmark ?? "",

    educationId: member.educationId ?? "",
    occupationId: member.occupationId ?? "",
    qualificationDetail: member.qualificationDetail ?? "",
    businessTypeId: member.businessTypeId ?? "",
    languagesKnown: tagsToInput(member.languagesKnown),
    skills: tagsToInput(member.skills),

    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactMobile: member.emergencyContactMobile ?? "",
    emergencyContactRelationship: member.emergencyContactRelationship ?? "",
  };
}

function formToDto(form: ProfileFormState): MemberSelfUpdateInput {
  return {
    title: form.title || null,
    firstName: form.firstName || null,
    middleName: form.middleName || null,
    lastName: form.lastName || null,
    fullName: form.fullName,
    gender: (form.gender || null) as MemberSelfUpdateInput["gender"],
    dob: inputToDate(form.dob),
    maritalStatus: (form.maritalStatus || null) as MemberSelfUpdateInput["maritalStatus"],
    bloodGroup: form.bloodGroup || null,
    nationality: form.nationality || null,
    religionId: form.religionId || null,
    casteCategoryId: form.casteCategoryId || null,

    fatherName: form.fatherName || null,
    motherName: form.motherName || null,
    spouseOrGuardianName: form.spouseOrGuardianName || null,
    familyTypeId: form.familyTypeId || null,
    familyMembersCount: inputToNumber(form.familyMembersCount),
    childrenCount: inputToNumber(form.childrenCount),
    monthlyIncome: inputToNumber(form.monthlyIncome),
    isDifferentlyAbled: form.isDifferentlyAbled,
    isExServiceman: form.isExServiceman,
    isSeniorCitizen: form.isSeniorCitizen,

    whatsappNumber: form.whatsappNumber || null,
    email: form.email || null,
    socialMediaLinks: form.socialMediaLinks || null,
    pincode: form.pincode || null,
    addressLine: form.addressLine || null,
    landmark: form.landmark || null,
    latitude: inputToNumber(form.latitude),
    longitude: inputToNumber(form.longitude),
    sameAsCurrentAddress: form.sameAsCurrentAddress,
    permPincode: (form.sameAsCurrentAddress ? form.pincode : form.permPincode) || null,
    permAddressLine: (form.sameAsCurrentAddress ? form.addressLine : form.permAddressLine) || null,
    permLandmark: (form.sameAsCurrentAddress ? form.landmark : form.permLandmark) || null,

    educationId: form.educationId || null,
    occupationId: form.occupationId || null,
    qualificationDetail: form.qualificationDetail || null,
    businessTypeId: form.businessTypeId || null,
    languagesKnown: inputToTags(form.languagesKnown),
    skills: inputToTags(form.skills),

    emergencyContactName: form.emergencyContactName || null,
    emergencyContactMobile: form.emergencyContactMobile || null,
    emergencyContactRelationship: form.emergencyContactRelationship || null,
  };
}

export function MyProfile() {
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const { data: allLookups = [] } = useMyAllLookups();
  const religions = allLookups.filter((l) => l.category === "RELIGION");
  const casteCategories = allLookups.filter((l) => l.category === "CASTE_CATEGORY");
  const familyTypes = allLookups.filter((l) => l.category === "FAMILY_TYPE");
  const educationLevels = allLookups.filter((l) => l.category === "EDUCATION");
  const occupations = allLookups.filter((l) => l.category === "OCCUPATION");
  const businessTypes = allLookups.filter((l) => l.category === "BUSINESS_TYPE");

  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only seed the form from the fetched profile once — react-query returns a
  // fresh object on every refetch (e.g. on window focus, since this query
  // uses the default staleTime/refetchOnWindowFocus), and re-running this on
  // every `profile` change would silently discard any unsaved edits.
  useEffect(() => {
    if (profile && !form) setForm(memberToForm(profile));
  }, [profile, form]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    try {
      await updateProfile.mutateAsync(formToDto(form));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Keep your details up to date. Mobile number and identity documents can only be changed by staff.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Mr, Mrs, Dr"
              value={form.title}
              onChange={(e) =>
                setForm((f) => {
                  if (!f) return f;
                  const title = e.target.value;
                  const fullName = f.hasNameParts
                    ? composeFullName({ ...f, title }, f.originalFullName)
                    : f.fullName;
                  return { ...f, title, fullName };
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
                  if (!f) return f;
                  const firstName = e.target.value;
                  const fullName = f.hasNameParts
                    ? composeFullName({ ...f, firstName }, f.originalFullName)
                    : f.fullName;
                  return { ...f, firstName, fullName };
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="middleName">Middle name</Label>
            <Input
              id="middleName"
              value={form.middleName}
              onChange={(e) =>
                setForm((f) => {
                  if (!f) return f;
                  const middleName = e.target.value;
                  const fullName = f.hasNameParts
                    ? composeFullName({ ...f, middleName }, f.originalFullName)
                    : f.fullName;
                  return { ...f, middleName, fullName };
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
                  if (!f) return f;
                  const lastName = e.target.value;
                  const fullName = f.hasNameParts
                    ? composeFullName({ ...f, lastName }, f.originalFullName)
                    : f.fullName;
                  return { ...f, lastName, fullName };
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
            onChange={(e) => setForm((f) => (f ? { ...f, gender: e.target.value } : f))}
            options={GENDER_OPTIONS}
          />
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={form.dob}
              onChange={(e) => setForm((f) => (f ? { ...f, dob: e.target.value } : f))}
            />
          </div>
          <NativeSelect
            id="maritalStatus"
            label="Marital status"
            placeholder="Select status"
            value={form.maritalStatus}
            onChange={(e) => setForm((f) => (f ? { ...f, maritalStatus: e.target.value } : f))}
            options={MARITAL_STATUS_OPTIONS}
          />
          <div className="space-y-1.5">
            <Label htmlFor="bloodGroup">Blood group</Label>
            <Input
              id="bloodGroup"
              placeholder="e.g. O+"
              value={form.bloodGroup}
              onChange={(e) => setForm((f) => (f ? { ...f, bloodGroup: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nationality">Nationality</Label>
            <Input
              id="nationality"
              placeholder="e.g. Indian"
              value={form.nationality}
              onChange={(e) => setForm((f) => (f ? { ...f, nationality: e.target.value } : f))}
            />
          </div>
          <NativeSelect
            id="religionId"
            label="Religion"
            placeholder="Select religion"
            value={form.religionId}
            onChange={(e) => setForm((f) => (f ? { ...f, religionId: e.target.value } : f))}
            options={selectableOptions(religions, form.religionId)}
          />
          <NativeSelect
            id="casteCategoryId"
            label="Caste category"
            placeholder="Select caste category"
            value={form.casteCategoryId}
            onChange={(e) => setForm((f) => (f ? { ...f, casteCategoryId: e.target.value } : f))}
            options={selectableOptions(casteCategories, form.casteCategoryId)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fatherName">Father's name</Label>
              <Input
                id="fatherName"
                value={form.fatherName}
                onChange={(e) => setForm((f) => (f ? { ...f, fatherName: e.target.value } : f))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motherName">Mother's name</Label>
              <Input
                id="motherName"
                value={form.motherName}
                onChange={(e) => setForm((f) => (f ? { ...f, motherName: e.target.value } : f))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spouseOrGuardianName">Spouse / guardian name</Label>
              <Input
                id="spouseOrGuardianName"
                value={form.spouseOrGuardianName}
                onChange={(e) => setForm((f) => (f ? { ...f, spouseOrGuardianName: e.target.value } : f))}
              />
            </div>
            <NativeSelect
              id="familyTypeId"
              label="Family type"
              placeholder="Select family type"
              value={form.familyTypeId}
              onChange={(e) => setForm((f) => (f ? { ...f, familyTypeId: e.target.value } : f))}
              options={selectableOptions(familyTypes, form.familyTypeId)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="familyMembersCount">Family members count</Label>
              <Input
                id="familyMembersCount"
                type="number"
                min="0"
                step="1"
                value={form.familyMembersCount}
                onChange={(e) => setForm((f) => (f ? { ...f, familyMembersCount: e.target.value } : f))}
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
                onChange={(e) => setForm((f) => (f ? { ...f, childrenCount: e.target.value } : f))}
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
                onChange={(e) => setForm((f) => (f ? { ...f, monthlyIncome: e.target.value } : f))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={form.isDifferentlyAbled}
                onChange={(e) => setForm((f) => (f ? { ...f, isDifferentlyAbled: e.target.checked } : f))}
              />
              Differently abled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={form.isExServiceman}
                onChange={(e) => setForm((f) => (f ? { ...f, isExServiceman: e.target.checked } : f))}
              />
              Ex-serviceman
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={form.isSeniorCitizen}
                onChange={(e) => setForm((f) => (f ? { ...f, isSeniorCitizen: e.target.checked } : f))}
              />
              Senior citizen
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="whatsappNumber">WhatsApp number</Label>
              <Input
                id="whatsappNumber"
                value={form.whatsappNumber}
                onChange={(e) => setForm((f) => (f ? { ...f, whatsappNumber: e.target.value } : f))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => (f ? { ...f, email: e.target.value } : f))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="socialMediaLinks">Social media links (optional)</Label>
              <Input
                id="socialMediaLinks"
                placeholder="e.g. facebook.com/yourname"
                value={form.socialMediaLinks}
                onChange={(e) => setForm((f) => (f ? { ...f, socialMediaLinks: e.target.value } : f))}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-heading text-sm font-semibold">Current Address</h3>
            <AddressFields
              idPrefix="current"
              value={{
                pincode: form.pincode,
                addressLine: form.addressLine,
                landmark: form.landmark,
                latitude: form.latitude,
                longitude: form.longitude,
              }}
              onChange={(next) => setForm((f) => (f ? { ...f, ...next } : f))}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-sm font-semibold">Permanent Address</h3>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={form.sameAsCurrentAddress}
                  onChange={(e) => setForm((f) => (f ? { ...f, sameAsCurrentAddress: e.target.checked } : f))}
                />
                Same as current address
              </label>
            </div>
            <AddressFields
              idPrefix="permanent"
              disabled={form.sameAsCurrentAddress}
              hideCoordinates={!form.sameAsCurrentAddress}
              value={
                form.sameAsCurrentAddress
                  ? {
                      pincode: form.pincode,
                      addressLine: form.addressLine,
                      landmark: form.landmark,
                      latitude: form.latitude,
                      longitude: form.longitude,
                    }
                  : {
                      pincode: form.permPincode,
                      addressLine: form.permAddressLine,
                      landmark: form.permLandmark,
                      latitude: "",
                      longitude: "",
                    }
              }
              onChange={(next) =>
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        permPincode: next.pincode,
                        permAddressLine: next.addressLine,
                        permLandmark: next.landmark,
                      }
                    : f,
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Education &amp; Occupation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NativeSelect
            id="educationId"
            label="Education"
            placeholder="Select education level"
            value={form.educationId}
            onChange={(e) => setForm((f) => (f ? { ...f, educationId: e.target.value } : f))}
            options={selectableOptions(educationLevels, form.educationId)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="qualificationDetail">Qualification detail</Label>
            <Input
              id="qualificationDetail"
              placeholder="e.g. B.Tech Computer Science"
              value={form.qualificationDetail}
              onChange={(e) => setForm((f) => (f ? { ...f, qualificationDetail: e.target.value } : f))}
            />
          </div>
          <NativeSelect
            id="occupationId"
            label="Occupation"
            placeholder="Select occupation"
            value={form.occupationId}
            onChange={(e) => setForm((f) => (f ? { ...f, occupationId: e.target.value } : f))}
            options={selectableOptions(occupations, form.occupationId)}
          />
          <NativeSelect
            id="businessTypeId"
            label="Business type (if self-employed)"
            placeholder="Select business type"
            value={form.businessTypeId}
            onChange={(e) => setForm((f) => (f ? { ...f, businessTypeId: e.target.value } : f))}
            options={selectableOptions(businessTypes, form.businessTypeId)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="languagesKnown">Languages known</Label>
            <Input
              id="languagesKnown"
              placeholder="Comma-separated, e.g. Hindi, English"
              value={form.languagesKnown}
              onChange={(e) => setForm((f) => (f ? { ...f, languagesKnown: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skills">Skills</Label>
            <Input
              id="skills"
              placeholder="Comma-separated, e.g. Teaching, First Aid"
              value={form.skills}
              onChange={(e) => setForm((f) => (f ? { ...f, skills: e.target.value } : f))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
              value={form.emergencyContactName}
              onChange={(e) => setForm((f) => (f ? { ...f, emergencyContactName: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactMobile">Mobile</Label>
            <Input
              id="emergencyContactMobile"
              value={form.emergencyContactMobile}
              onChange={(e) => setForm((f) => (f ? { ...f, emergencyContactMobile: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input
              id="emergencyContactRelationship"
              value={form.emergencyContactRelationship}
              onChange={(e) => setForm((f) => (f ? { ...f, emergencyContactRelationship: e.target.value } : f))}
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={updateProfile.isPending}
        className="bg-brand-green hover:bg-brand-green/90"
      >
        {updateProfile.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
