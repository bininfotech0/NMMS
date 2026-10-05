import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLookups } from "@/hooks/useLookups";
import { usePlans } from "@/hooks/usePlans";
import type { StepProps } from "../wizard-types";
import { ReferrerField } from "./ReferrerField";

const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "ONE_TIME", label: "One-time" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly" },
  { value: "ANNUAL", label: "Annual" },
];

export function StepMembership({ form, setForm, memberId }: StepProps) {
  const { data: plans = [] } = usePlans();
  const { data: categories = [] } = useLookups("MEMBERSHIP_CATEGORY");
  const { data: branches = [] } = useLookups("BRANCH");
  // Keep the optional block open when editing a member who already has values in it.
  const hasAdvanced = Boolean(
    form.membershipCategoryId || form.branchId || form.feeOverride || form.paymentFrequency || form.unit || form.membershipRemarks,
  );

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">
        Only the plan is required. Everything else on this screen can be left as it is.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
      <NativeSelect
        id="planId"
        label="Membership plan"
        placeholder="Select a plan"
        value={form.planId}
        onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}
        options={plans.filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name }))}
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
      <div className="sm:col-span-2">
        <ReferrerField
          value={form.referralMemberId}
          onChange={(id) => setForm((f) => ({ ...f, referralMemberId: id }))}
          excludeMemberId={memberId}
        />
      </div>
      </div>
      <details className="group mt-4 rounded-lg border border-dashed border-border" open={hasAdvanced}>
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-muted-foreground">
          <span className="group-open:hidden">▸ </span>
          <span className="hidden group-open:inline">▾ </span>
          More options (category, branch, special fee, remarks)
        </summary>
        <div className="grid gap-4 p-3 sm:grid-cols-2">
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
        <Label htmlFor="feeOverride">Special fee (optional)</Label>
        <Input
          id="feeOverride"
          type="number"
          min="0"
          step="0.01"
          placeholder="Leave empty to use the plan's fee"
          value={form.feeOverride}
          onChange={(e) => setForm((f) => ({ ...f, feeOverride: e.target.value }))}
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
        <Input
          id="unit"
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
        />
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
      </details>
    </div>
  );
}
