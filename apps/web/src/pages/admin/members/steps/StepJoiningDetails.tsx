import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLookups } from "@/hooks/useLookups";
import type { StepProps } from "../wizard-types";

const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "ONE_TIME", label: "One-time" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly" },
  { value: "ANNUAL", label: "Annual" },
];

// Non-financial joining metadata only — plan/fee are edited via the
// "Upgrade Plan" flow on the profile page, not here. See MembersService.update's
// ConflictException guard: changing planId/feeOverride once a member has left
// DRAFT is rejected server-side, so this step deliberately never touches them.
export function StepJoiningDetails({ form, setForm }: StepProps) {
  const { data: categories = [] } = useLookups("MEMBERSHIP_CATEGORY");
  const { data: branches = [] } = useLookups("BRANCH");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NativeSelect
        id="membershipCategoryId"
        label="Membership category"
        placeholder="Select a category"
        value={form.membershipCategoryId}
        onChange={(e) => setForm((f) => ({ ...f, membershipCategoryId: e.target.value }))}
        options={categories.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.value }))}
      />
      <NativeSelect
        id="branchId"
        label="Branch"
        placeholder="Select a branch"
        value={form.branchId}
        onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
        options={branches.filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.value }))}
      />
      <div className="space-y-1.5">
        <Label htmlFor="joiningDate">Joining date</Label>
        <Input
          id="joiningDate"
          type="date"
          value={form.joiningDate}
          onChange={(e) => setForm((f) => ({ ...f, joiningDate: e.target.value }))}
        />
      </div>
      <NativeSelect
        id="paymentFrequency"
        label="Payment frequency"
        placeholder="Select frequency"
        value={form.paymentFrequency}
        onChange={(e) => setForm((f) => ({ ...f, paymentFrequency: e.target.value }))}
        options={PAYMENT_FREQUENCY_OPTIONS}
      />
      <div className="space-y-1.5">
        <Label htmlFor="unit">Unit</Label>
        <Input id="unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="membershipRemarks">Remarks</Label>
        <Input
          id="membershipRemarks"
          value={form.membershipRemarks}
          onChange={(e) => setForm((f) => ({ ...f, membershipRemarks: e.target.value }))}
        />
      </div>
    </div>
  );
}
