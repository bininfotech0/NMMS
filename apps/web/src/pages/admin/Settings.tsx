import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useOrgProfile, useUpdateOrg } from "@/hooks/useOrg";
import {
  useIntegrations,
  usePaymentGatewayCredentialsStatus,
  useSetPaymentGatewayMode,
  useUpdateIntegration,
  useUpdatePaymentGatewayCredentials,
} from "@/hooks/useIntegrations";
import { useCreateLookup, useLookups, useUpdateLookup } from "@/hooks/useLookups";
import { useReferralPointRules, useUpsertReferralPointRuleMatrix } from "@/hooks/useReferrals";
import { useAuthStore } from "@/stores/auth";
import {
  PLAN_TIER_ORDER,
  type FeatureFlagKey,
  type LookupCategory,
  type RazorpayMode,
  type WithdrawalChargeType,
} from "@nmms/shared";

const PLAN_TIERS = PLAN_TIER_ORDER;

const REQUIRED_FIELD_BLANK_ERROR = "Please fill in all required fields — they can't be left blank.";

function hasBlankField(values: string[]): boolean {
  return values.some((v) => v.trim() === "");
}

const TABS = ["Organization", "Referral Program", "Withdrawals & KYC", "Online payments & messages", "Dropdown lists"] as const;

const LOOKUP_CATEGORIES: LookupCategory[] = [
  "RELIGION",
  "CASTE_CATEGORY",
  "BUSINESS_TYPE",
  "MEMBERSHIP_CATEGORY",
  "BRANCH",
  "EDUCATION",
  "OCCUPATION",
  "BLOOD_GROUP",
  "FAMILY_TYPE",
];

const LOOKUP_CATEGORY_LABELS: Record<LookupCategory, string> = {
  RELIGION: "Religion",
  CASTE_CATEGORY: "Caste Category",
  BUSINESS_TYPE: "Business Type",
  MEMBERSHIP_CATEGORY: "Membership Category",
  BRANCH: "Branch",
  EDUCATION: "Education",
  OCCUPATION: "Occupation",
  BLOOD_GROUP: "Blood Group",
  FAMILY_TYPE: "Family Type",
};

// Only describe messages the code actually sends (see NotificationService):
// payment receipt, welcome on activation, plan upgrade, expiry reminders.
const INTEGRATION_INFO: Record<FeatureFlagKey, { label: string; description: string }> = {
  PAYMENT_GATEWAY: {
    label: "Online payments (Razorpay)",
    description: "Lets members pay their fee and donations online by UPI or card.",
  },
  PAYMENT_GATEWAY_PAYOUTS: {
    label: "Send money to members (RazorpayX)",
    description: "Sends members' money requests straight to their bank. Without it, pay them yourself and tap “Mark paid”.",
  },
  WHATSAPP_NOTIFY: {
    label: "WhatsApp messages",
    description: "Sends payment receipts, welcome messages, plan upgrades, and reminders before a membership ends — on WhatsApp.",
  },
  AI_DEDUPE: {
    label: "Duplicate check (AI)",
    description: "Warns staff when a new registration looks like an existing member.",
  },
  AI_OCR: {
    label: "Read ID documents (AI)",
    description: "Fills in details automatically from uploaded ID documents.",
  },
  SMS: { label: "SMS messages", description: "Sends payment receipts, welcome messages, plan upgrades, and reminders before a membership ends — by SMS." },
  EMAIL: { label: "Email messages", description: "Sends payment receipts, welcome messages, plan upgrades, and reminders before a membership ends — by email." },
};

// Flags with an expandable credential form below the enable/disable toggle.
const CONFIGURABLE_INTEGRATION_KEYS = new Set<FeatureFlagKey>([
  "PAYMENT_GATEWAY",
  "PAYMENT_GATEWAY_PAYOUTS",
  "SMS",
  "WHATSAPP_NOTIFY",
  "EMAIL",
]);

// Example of what a number format produces, so admins don't have to decode
// {PREFIX}/{YYYY}/{SEQ}. Illustrative only — the server assigns real values.
function previewNumberFormat(format: string): string {
  if (!format.trim()) return "—";
  const year = String(new Date().getFullYear());
  return format
    .replace(/\{PREFIX\}/g, "VV")
    .replace(/\{YYYY\}/g, year)
    .replace(/\{YY\}/g, year.slice(-2))
    .replace(/\{SEQ\}/g, "0001");
}

function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="bg-muted font-mono text-xs" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copied");
        }}
      >
        <Copy className="size-4" />
        Copy
      </Button>
    </div>
  );
}

export function Settings() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Organization");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your NGO's details, the referral scheme, and online payments and messages</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-brand-green text-white"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Organization" && <OrganizationSettings />}
      {tab === "Referral Program" && <ReferralProgramSettings />}
      {tab === "Withdrawals & KYC" && <WithdrawalKycSettings />}
      {tab === "Online payments & messages" && <IntegrationsSettings />}
      {tab === "Dropdown lists" && <LookupsSettings />}
    </div>
  );
}

function OrganizationSettings() {
  const { data: org, isLoading, isError, error } = useOrgProfile();
  const updateOrg = useUpdateOrg();

  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankIfscCode: "",
    bankName: "",
    membershipNumberFormat: "",
    receiptNumberFormat: "",
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name,
      logoUrl: org.logoUrl ?? "",
      address: org.address ?? "",
      contactEmail: org.contactEmail ?? "",
      contactPhone: org.contactPhone ?? "",
      bankAccountName: org.bankAccountName ?? "",
      bankAccountNumber: org.bankAccountNumber ?? "",
      bankIfscCode: org.bankIfscCode ?? "",
      bankName: org.bankName ?? "",
      membershipNumberFormat: org.membershipNumberFormat,
      receiptNumberFormat: org.receiptNumberFormat,
    });
  }, [org]);

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    try {
      await updateOrg.mutateAsync(form);
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading organization settings...
      </div>
    );
  }
  if (isError) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
        {forbidden ? "You don't have permission to view organization settings." : "Failed to load settings."}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 font-heading text-base font-semibold">Your NGO</h2>
        <p className="mb-4 text-sm text-muted-foreground">Shown on membership cards and receipts, and to members who need to contact you.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" {...field("name")} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...field("address")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Email for members</Label>
            <Input id="contactEmail" type="email" {...field("contactEmail")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactPhone">Phone number for members</Label>
            <Input id="contactPhone" {...field("contactPhone")} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-heading text-base font-semibold">Bank Details</h2>
        <p className="mb-4 text-sm text-muted-foreground">Printed on receipts for bank-transfer payers.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bankName">Bank name</Label>
            <Input id="bankName" {...field("bankName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountName">Account holder name</Label>
            <Input id="bankAccountName" {...field("bankAccountName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input id="bankAccountNumber" {...field("bankAccountNumber")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankIfscCode">IFSC code</Label>
            <Input
              id="bankIfscCode"
              {...field("bankIfscCode")}
              onChange={(e) => setForm((f) => ({ ...f, bankIfscCode: e.target.value.toUpperCase() }))}
              pattern="[A-Z]{4}0[A-Z0-9]{6}"
              placeholder="SBIN0001234"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 font-heading text-base font-semibold">Number style</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          How new member numbers and receipt numbers look. Usually you don't need to change this. Special words:{" "}
          <code>{"{YYYY}"}</code> = year, <code>{"{SEQ}"}</code> = running number, <code>{"{PREFIX}"}</code> = your short code.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="membershipNumberFormat">Member number</Label>
            <Input id="membershipNumberFormat" {...field("membershipNumberFormat")} />
            <p className="text-xs text-muted-foreground">
              Looks like: <span className="font-medium">{previewNumberFormat(form.membershipNumberFormat)}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receiptNumberFormat">Receipt number</Label>
            <Input id="receiptNumberFormat" {...field("receiptNumberFormat")} />
            <p className="text-xs text-muted-foreground">
              Looks like: <span className="font-medium">{previewNumberFormat(form.receiptNumberFormat)}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={updateOrg.isPending}
          className="bg-brand-green hover:bg-brand-green/90"
        >
          {updateOrg.isPending ? "Saving…" : "Save Changes"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved ✓</span>}
        {formError && <span className="text-sm text-destructive">{formError}</span>}
      </div>
    </form>
  );
}

function ReferralProgramSettings() {
  const { data: org, isLoading, isError, error } = useOrgProfile();
  const updateOrg = useUpdateOrg();

  const [form, setForm] = useState({
    referralProgramEnabled: false,
    pointsPerApprovedReferral: "10",
    referralPointsCapPerMember: "",
    referralRequireActiveReferrerPlan: true,
    pointsToMoneyRatioPoints: "100",
    pointsToMoneyRatioAmount: "10",
    donationPointsPercent: "0",
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    setForm({
      referralProgramEnabled: org.referralProgramEnabled,
      pointsPerApprovedReferral: String(org.pointsPerApprovedReferral),
      referralPointsCapPerMember:
        org.referralPointsCapPerMember != null ? String(org.referralPointsCapPerMember) : "",
      referralRequireActiveReferrerPlan: org.referralRequireActiveReferrerPlan,
      pointsToMoneyRatioPoints: String(org.pointsToMoneyRatioPoints),
      pointsToMoneyRatioAmount: String(org.pointsToMoneyRatioAmount),
      donationPointsPercent: String(org.donationPointsPercent),
    });
  }, [org]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    if (
      hasBlankField([
        form.pointsPerApprovedReferral,
        form.pointsToMoneyRatioPoints,
        form.pointsToMoneyRatioAmount,
        form.donationPointsPercent,
      ])
    ) {
      setFormError(REQUIRED_FIELD_BLANK_ERROR);
      return;
    }
    try {
      await updateOrg.mutateAsync({
        referralProgramEnabled: form.referralProgramEnabled,
        pointsPerApprovedReferral: Number(form.pointsPerApprovedReferral),
        referralPointsCapPerMember:
          form.referralPointsCapPerMember === "" ? null : Number(form.referralPointsCapPerMember),
        referralRequireActiveReferrerPlan: form.referralRequireActiveReferrerPlan,
        pointsToMoneyRatioPoints: Number(form.pointsToMoneyRatioPoints),
        pointsToMoneyRatioAmount: Number(form.pointsToMoneyRatioAmount),
        donationPointsPercent: Number(form.donationPointsPercent),
      });
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading referral program settings...
      </div>
    );
  }
  if (isError) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
        {forbidden ? "You don't have permission to view these settings." : "Failed to load settings."}
      </div>
    );
  }

  const conversionPreview = (() => {
    const points = Number(form.pointsToMoneyRatioPoints);
    const amount = Number(form.pointsToMoneyRatioAmount);
    if (!points || !Number.isFinite(amount)) return null;
    return `${points} points = ₹${amount.toFixed(2)} → 1 point = ₹${(amount / points).toFixed(4)}`;
  })();

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-semibold">Refer &amp; Earn</h2>
              <p className="text-sm text-muted-foreground">
                How it works: every active member gets a personal link. When someone joins and pays using that link, the
                member gets points. Points can be changed into money and sent to the member's bank.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.referralProgramEnabled}
              aria-label={`Refer & Earn: ${form.referralProgramEnabled ? "on" : "off"}`}
              onClick={() => setForm((f) => ({ ...f, referralProgramEnabled: !f.referralProgramEnabled }))}
              className="flex shrink-0 items-center gap-2 text-sm font-medium"
            >
              <span
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
                  form.referralProgramEnabled ? "bg-brand-green" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                    form.referralProgramEnabled ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </span>
              <span className={form.referralProgramEnabled ? "text-brand-green" : "text-muted-foreground"}>
                {form.referralProgramEnabled ? "On" : "Off"}
              </span>
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-base font-semibold">Points</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pointsPerApprovedReferral">Points for each person who joins with a member's link</Label>
              <Input
                id="pointsPerApprovedReferral"
                type="number"
                min="0"
                value={form.pointsPerApprovedReferral}
                onChange={(e) => setForm((f) => ({ ...f, pointsPerApprovedReferral: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Used unless you set a different number in "Points by plan" below.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="donationPointsPercent">Points for donations (% of the amount given)</Label>
              <Input
                id="donationPointsPercent"
                type="number"
                min="0"
                max="100"
                value={form.donationPointsPercent}
                onChange={(e) => setForm((f) => ({ ...f, donationPointsPercent: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                % of a donation's amount credited as reward points once approved. 0 disables the points reward.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            A member's volunteer batch mirrors their paid Membership Plan tier — it's granted automatically
            when a member is activated or their plan is upgraded, and isn't configurable here.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 font-heading text-base font-semibold">Limits</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Optional guardrails on who can earn referral points and how much.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="referralPointsCapPerMember">Maximum points one member can ever earn</Label>
              <Input
                id="referralPointsCapPerMember"
                type="number"
                min="0"
                placeholder="No limit"
                value={form.referralPointsCapPerMember}
                onChange={(e) => setForm((f) => ({ ...f, referralPointsCapPerMember: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leave empty for no limit.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Only members with an active membership earn points</Label>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(form.referralRequireActiveReferrerPlan && "border-brand-green text-brand-green")}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      referralRequireActiveReferrerPlan: !f.referralRequireActiveReferrerPlan,
                    }))
                  }
                >
                  {form.referralRequireActiveReferrerPlan ? "Required" : "Not required"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                When required, a referrer whose membership plan is deactivated earns no further referral points.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 font-heading text-base font-semibold">How much money points are worth</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The ratio used to convert earned points into rupees (used by wallet/withdrawal features).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pointsToMoneyRatioPoints">Points</Label>
              <Input
                id="pointsToMoneyRatioPoints"
                type="number"
                min="1"
                value={form.pointsToMoneyRatioPoints}
                onChange={(e) => setForm((f) => ({ ...f, pointsToMoneyRatioPoints: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pointsToMoneyRatioAmount">= ₹ Amount</Label>
              <Input
                id="pointsToMoneyRatioAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.pointsToMoneyRatioAmount}
                onChange={(e) => setForm((f) => ({ ...f, pointsToMoneyRatioAmount: e.target.value }))}
              />
            </div>
          </div>
          {conversionPreview && <p className="mt-3 text-xs text-muted-foreground">{conversionPreview}</p>}
        </section>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={updateOrg.isPending}
            className="bg-brand-green hover:bg-brand-green/90"
          >
            {updateOrg.isPending ? "Saving…" : "Save Changes"}
          </Button>
          {saved && <span className="text-sm text-brand-green">Saved ✓</span>}
          {formError && <span className="text-sm text-destructive">{formError}</span>}
        </div>
      </form>

      <ReferralPointMatrixSection />
    </div>
  );
}

function ReferralPointMatrixSection() {
  const { data: rules = [], isLoading } = useReferralPointRules();
  const upsertMatrix = useUpsertReferralPointRuleMatrix();

  const [grid, setGrid] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const referrerTier of PLAN_TIERS) {
      for (const referredTier of PLAN_TIERS) {
        const rule = rules.find((r) => r.referrerTier === referrerTier && r.referredTier === referredTier);
        next[`${referrerTier}-${referredTier}`] = rule ? String(rule.points) : "";
      }
    }
    setGrid(next);
  }, [rules]);

  async function handleSave() {
    const payload = PLAN_TIERS.flatMap((referrerTier) =>
      PLAN_TIERS.filter((referredTier) => grid[`${referrerTier}-${referredTier}`] !== "").map(
        (referredTier) => ({
          referrerTier,
          referredTier,
          points: Number(grid[`${referrerTier}-${referredTier}`]),
        }),
      ),
    );
    await upsertMatrix.mutateAsync(payload);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 font-heading text-base font-semibold">Points by plan (optional)</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Give different points depending on plans. Each row is the plan of the member who shared the link; each column is
        the plan of the new member who joined. Leave a box empty to use the normal number above.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-medium text-muted-foreground">
                  Referrer \ Referred
                </th>
                {PLAN_TIERS.map((tier) => (
                  <th key={tier} className="p-2 text-left text-xs font-medium text-muted-foreground">
                    {tier.charAt(0) + tier.slice(1).toLowerCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_TIERS.map((referrerTier) => (
                <tr key={referrerTier}>
                  <td className="p-2 text-xs font-medium text-muted-foreground">
                    {referrerTier.charAt(0) + referrerTier.slice(1).toLowerCase()}
                  </td>
                  {PLAN_TIERS.map((referredTier) => {
                    const key = `${referrerTier}-${referredTier}`;
                    return (
                      <td key={key} className="p-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={grid[key] ?? ""}
                          onChange={(e) => setGrid((g) => ({ ...g, [key]: e.target.value }))}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4">
        <Button
          type="button"
          disabled={upsertMatrix.isPending || isLoading}
          onClick={handleSave}
          className="bg-brand-green hover:bg-brand-green/90"
        >
          {upsertMatrix.isPending ? "Saving…" : "Save Matrix"}
        </Button>
      </div>
    </section>
  );
}

function WithdrawalKycSettings() {
  const { data: org, isLoading, isError, error } = useOrgProfile();
  const updateOrg = useUpdateOrg();

  const [form, setForm] = useState({
    kycRequireAadhaar: true,
    kycRequirePan: false,
    kycRequireBankOrUpi: true,
    withdrawalMinAmount: "100",
    withdrawalMaxAmount: "",
    withdrawalFrequencyDays: "",
    withdrawalChargeType: "NONE" as WithdrawalChargeType,
    withdrawalChargeValue: "0",
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    setForm({
      kycRequireAadhaar: org.kycRequireAadhaar,
      kycRequirePan: org.kycRequirePan,
      kycRequireBankOrUpi: org.kycRequireBankOrUpi,
      withdrawalMinAmount: String(org.withdrawalMinAmount),
      withdrawalMaxAmount: org.withdrawalMaxAmount != null ? String(org.withdrawalMaxAmount) : "",
      withdrawalFrequencyDays: org.withdrawalFrequencyDays != null ? String(org.withdrawalFrequencyDays) : "",
      withdrawalChargeType: org.withdrawalChargeType,
      withdrawalChargeValue: String(org.withdrawalChargeValue),
    });
  }, [org]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    if (hasBlankField([form.withdrawalMinAmount, form.withdrawalChargeValue])) {
      setFormError(REQUIRED_FIELD_BLANK_ERROR);
      return;
    }
    try {
      await updateOrg.mutateAsync({
        kycRequireAadhaar: form.kycRequireAadhaar,
        kycRequirePan: form.kycRequirePan,
        kycRequireBankOrUpi: form.kycRequireBankOrUpi,
        withdrawalMinAmount: Number(form.withdrawalMinAmount),
        withdrawalMaxAmount: form.withdrawalMaxAmount === "" ? null : Number(form.withdrawalMaxAmount),
        withdrawalFrequencyDays: form.withdrawalFrequencyDays === "" ? null : Number(form.withdrawalFrequencyDays),
        withdrawalChargeType: form.withdrawalChargeType,
        withdrawalChargeValue: Number(form.withdrawalChargeValue),
      });
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading withdrawal & KYC settings...
      </div>
    );
  }
  if (isError) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
        {forbidden ? "You don't have permission to view these settings." : "Failed to load settings."}
      </div>
    );
  }

  const chargePreview = (() => {
    const value = Number(form.withdrawalChargeValue);
    if (form.withdrawalChargeType === "NONE") return "No charge on withdrawals.";
    if (form.withdrawalChargeType === "FLAT") return `Flat ₹${value} deducted from every withdrawal.`;
    return `${value}% deducted from every withdrawal.`;
  })();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 font-heading text-base font-semibold">What members need before taking out money</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Name and mobile number are always needed. Choose what else a member must have saved before they can take out
          their points as money.
        </p>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["kycRequireAadhaar", "Aadhaar"],
              ["kycRequirePan", "PAN"],
              ["kycRequireBankOrUpi", "Bank account or UPI"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className={cn(form[key] && "border-brand-green text-brand-green")}
              onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
            >
              {label}: {form[key] ? "Required" : "Optional"}
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-heading text-base font-semibold">Withdrawal Limits</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="withdrawalMinAmount">Minimum amount (₹)</Label>
            <Input
              id="withdrawalMinAmount"
              type="number"
              min="0"
              value={form.withdrawalMinAmount}
              onChange={(e) => setForm((f) => ({ ...f, withdrawalMinAmount: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="withdrawalMaxAmount">Maximum amount (₹)</Label>
            <Input
              id="withdrawalMaxAmount"
              type="number"
              min="0"
              placeholder="No limit"
              value={form.withdrawalMaxAmount}
              onChange={(e) => setForm((f) => ({ ...f, withdrawalMaxAmount: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="withdrawalFrequencyDays">Minimum days between requests</Label>
            <Input
              id="withdrawalFrequencyDays"
              type="number"
              min="0"
              placeholder="No limit"
              value={form.withdrawalFrequencyDays}
              onChange={(e) => setForm((f) => ({ ...f, withdrawalFrequencyDays: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-heading text-base font-semibold">Withdrawal Charges</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <NativeSelect
            id="withdrawalChargeType"
            label="Charge type"
            value={form.withdrawalChargeType}
            onChange={(e) =>
              setForm((f) => ({ ...f, withdrawalChargeType: e.target.value as WithdrawalChargeType }))
            }
            options={[
              { value: "NONE", label: "No charge" },
              { value: "FLAT", label: "Flat amount (₹)" },
              { value: "PERCENTAGE", label: "Percentage (%)" },
            ]}
          />
          {form.withdrawalChargeType !== "NONE" && (
            <div className="space-y-1.5">
              <Label htmlFor="withdrawalChargeValue">
                {form.withdrawalChargeType === "FLAT" ? "Charge amount (₹)" : "Charge percentage (%)"}
              </Label>
              <Input
                id="withdrawalChargeValue"
                type="number"
                min="0"
                step="0.01"
                value={form.withdrawalChargeValue}
                onChange={(e) => setForm((f) => ({ ...f, withdrawalChargeValue: e.target.value }))}
              />
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{chargePreview}</p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateOrg.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateOrg.isPending ? "Saving…" : "Save Changes"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved ✓</span>}
        {formError && <span className="text-sm text-destructive">{formError}</span>}
      </div>
    </form>
  );
}

function IntegrationsSettings() {
  const { data: flags = [], isLoading, isError, error } = useIntegrations();
  const updateIntegration = useUpdateIntegration();
  const [expandedKey, setExpandedKey] = useState<FeatureFlagKey | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading integrations...
      </div>
    );
  }
  if (isError) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
        {forbidden ? "You don't have permission to view integrations." : "Failed to load integrations."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Each service needs two things: first tap <span className="font-medium">Set up</span> and paste the keys from that
        company's website, then turn the switch <span className="font-medium">On</span>.
      </p>
      {flags.map((flag) => {
        const info = INTEGRATION_INFO[flag.key];
        return (
          <div key={flag.key} className="rounded-xl border border-border bg-card p-4">
            {/* Stacks on phones so the description isn't squeezed beside the buttons. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{info.label}</span>
                  {flag.hasConfig && (
                    <Badge variant="outline" className="border-transparent bg-brand-bg-soft text-xs text-brand-green">
                      Set up ✓
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{info.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {CONFIGURABLE_INTEGRATION_KEYS.has(flag.key) && (
                  <Button size="sm" variant="ghost" onClick={() => setExpandedKey((k) => (k === flag.key ? null : flag.key))}>
                    {flag.hasConfig ? "Change setup" : "Set up"}
                    {expandedKey === flag.key ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                )}
                {/* A real On/Off switch — the old button showed the current state as its label, which read as an action. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.enabled}
                  aria-label={`${info.label}: ${flag.enabled ? "on" : "off"}`}
                  disabled={updateIntegration.isPending}
                  onClick={() => updateIntegration.mutate({ key: flag.key, dto: { enabled: !flag.enabled } })}
                  className="flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                >
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
                      flag.enabled ? "bg-brand-green" : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                        flag.enabled ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </span>
                  <span className={cn("w-7 text-left", flag.enabled ? "text-brand-green" : "text-muted-foreground")}>
                    {flag.enabled ? "On" : "Off"}
                  </span>
                </button>
              </div>
            </div>
            {flag.key === "PAYMENT_GATEWAY" && expandedKey === "PAYMENT_GATEWAY" && (
              <PaymentGatewayConfigForm enabled={flag.enabled} />
            )}
            {flag.key === "PAYMENT_GATEWAY_PAYOUTS" && expandedKey === "PAYMENT_GATEWAY_PAYOUTS" && (
              <PayoutGatewayConfigForm />
            )}
            {flag.key === "SMS" && expandedKey === "SMS" && (
              <TwilioConfigForm flagKey="SMS" fromLabel="Your Twilio phone number (with country code)" fromPlaceholder="+919876543210" />
            )}
            {flag.key === "WHATSAPP_NOTIFY" && expandedKey === "WHATSAPP_NOTIFY" && (
              <TwilioConfigForm
                flagKey="WHATSAPP_NOTIFY"
                fromLabel="Your WhatsApp business number (with country code)"
                fromPlaceholder="+919876543210"
              />
            )}
            {flag.key === "EMAIL" && expandedKey === "EMAIL" && <ResendConfigForm />}
          </div>
        );
      })}
    </div>
  );
}

const MODE_LABELS: Record<RazorpayMode, string> = { test: "Practice (test)", live: "Real payments (live)" };

function PaymentGatewayConfigForm({ enabled }: { enabled: boolean }) {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const { data: status } = usePaymentGatewayCredentialsStatus();
  const setMode = useSetPaymentGatewayMode();

  const webhookUrl = organizationId
    ? `${window.location.origin}/api/v1/webhooks/razorpay/${organizationId}`
    : "";

  const activeMode = status?.mode ?? "test";
  const [confirmLive, setConfirmLive] = useState(false);
  const hasAnyConfig = (status?.hasTestConfig || status?.hasLiveConfig) ?? false;

  return (
    <div className="mt-4 space-y-5 border-t border-border pt-4">
      {hasAnyConfig && !enabled && (
        <div className="rounded-lg border border-brand-gold/40 bg-brand-bg-soft px-3 py-2 text-sm text-brand-brown">
          Your keys are saved, but online payments are switched <strong>Off</strong>. Turn the switch above{" "}
          <strong>On</strong> when you're ready.
        </div>
      )}
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Sign in at{" "}
          <a href="https://dashboard.razorpay.com" target="_blank" rel="noreferrer" className="text-brand-green hover:underline">
            dashboard.razorpay.com
          </a>{" "}
          and open <span className="font-medium">Account &amp; Settings → API Keys</span>. Copy the Key ID and Key Secret.
        </li>
        <li>
          In Razorpay open <span className="font-medium">Webhooks → Add webhook</span>, paste the address below, choose a
          secret word, and copy it.
        </li>
        <li>Paste all three into the boxes below. Start with Practice mode, try a payment, then add the Real payment keys.</li>
      </ol>
      <div className="space-y-1.5">
        <Label>Mode</Label>
        <p className="text-xs text-muted-foreground">
          Practice mode uses test money — nothing is really charged. Switch to Real payments when you're ready to collect
          money from members.
        </p>
        <div className="flex gap-2">
          {(["test", "live"] as RazorpayMode[]).map((mode) => {
            const hasConfig = mode === "test" ? status?.hasTestConfig : status?.hasLiveConfig;
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={!hasConfig || isActive || setMode.isPending}
                onClick={() => (mode === "live" ? setConfirmLive(true) : setMode.mutate(mode))}
                title={!hasConfig ? `Save the ${MODE_LABELS[mode].toLowerCase()} keys below first` : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  isActive
                    ? "border-brand-green bg-brand-bg-soft text-brand-green"
                    : "border-border text-muted-foreground hover:border-brand-green hover:text-brand-green",
                )}
              >
                {MODE_LABELS[mode]}
                {isActive && " (in use)"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Webhook address — copy this into Razorpay (step 2)</Label>
        <CopyField value={webhookUrl} label="Webhook address" />
        <p className="text-xs text-muted-foreground">
          Use the same address in Practice and Real mode. It lets Razorpay tell NMMS when a member has paid.
        </p>
      </div>
      <ConfirmDialog
        open={confirmLive}
        onOpenChange={setConfirmLive}
        title="Switch to real payments?"
        description="From now on, members will be charged real money when they pay online. Make sure you tried a payment in Practice mode first."
        confirmLabel="Use real payments"
        destructive={false}
        isPending={setMode.isPending}
        onConfirm={() => setMode.mutate("live", { onSettled: () => setConfirmLive(false) })}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <RazorpayModeCredentialsForm mode="test" configured={status?.hasTestConfig ?? false} />
        <RazorpayModeCredentialsForm mode="live" configured={status?.hasLiveConfig ?? false} />
      </div>
    </div>
  );
}

function RazorpayModeCredentialsForm({ mode, configured }: { mode: RazorpayMode; configured: boolean }) {
  const updateCredentials = useUpdatePaymentGatewayCredentials();

  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await updateCredentials.mutateAsync({ mode, credentials: { keyId, keySecret, webhookSecret } });
    setKeyId("");
    setKeySecret("");
    setWebhookSecret("");
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{MODE_LABELS[mode]} keys</span>
        {configured && (
          <Badge variant="outline" className="border-transparent bg-brand-bg-soft text-brand-green">
            Saved ✓
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`rzp-${mode}-key-id`}>Key ID (starts with {mode === "live" ? "rzp_live_" : "rzp_test_"})</Label>
        <Input
          id={`rzp-${mode}-key-id`}
          name={`rzp-${mode}-key-id`}
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder={mode === "live" ? "rzp_live_..." : "rzp_test_..."}
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`rzp-${mode}-key-secret`}>Key Secret</Label>
        <Input
          id={`rzp-${mode}-key-secret`}
          name={`rzp-${mode}-key-secret`}
          type="password"
          value={keySecret}
          onChange={(e) => setKeySecret(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`rzp-${mode}-webhook-secret`}>Webhook secret word (from step 2)</Label>
        <Input
          id={`rzp-${mode}-webhook-secret`}
          name={`rzp-${mode}-webhook-secret`}
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Kept secret and locked away. For safety they won't be shown again after you save.
      </p>
      <Button
        type="submit"
        size="sm"
        disabled={updateCredentials.isPending}
        className="w-full bg-brand-green hover:bg-brand-green/90"
      >
        {updateCredentials.isPending ? "Saving…" : `Save ${MODE_LABELS[mode].toLowerCase()} keys`}
      </Button>
    </form>
  );
}

function PayoutGatewayConfigForm() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const updateIntegration = useUpdateIntegration();

  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saved, setSaved] = useState(false);

  const webhookUrl = organizationId
    ? `${window.location.origin}/api/v1/webhooks/razorpayx-payouts/${organizationId}`
    : "";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await updateIntegration.mutateAsync({
      key: "PAYMENT_GATEWAY_PAYOUTS",
      dto: { config: { keyId, keySecret, webhookSecret, accountNumber } },
    });
    setKeyId("");
    setKeySecret("");
    setWebhookSecret("");
    setAccountNumber("");
    setSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-4 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        You need a RazorpayX account (Razorpay's business banking). Copy these from{" "}
        <a href="https://x.razorpay.com" target="_blank" rel="noreferrer" className="text-brand-green hover:underline">
          x.razorpay.com
        </a>
        . Not using RazorpayX? Leave this switched off and pay members yourself.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-key-id">Key ID (starts with rzp_)</Label>
          <Input
            id="rzpx-key-id"
            name="rzpx-key-id"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_live_..."
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-key-secret">Key Secret</Label>
          <Input
            id="rzpx-key-secret"
            name="rzpx-key-secret"
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-account-number">RazorpayX account number</Label>
          <Input
            id="rzpx-account-number"
            name="rzpx-account-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="The account money is sent from"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-webhook-secret">Webhook secret word</Label>
          <Input
            id="rzpx-webhook-secret"
            name="rzpx-webhook-secret"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="From Razorpay Dashboard → Webhooks"
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Webhook address — copy this into RazorpayX → Webhooks</Label>
        <CopyField value={webhookUrl} label="Payout webhook address" />
      </div>

      <p className="text-xs text-muted-foreground">
        Kept secret and locked away. For safety they won't be shown again after you save.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateIntegration.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateIntegration.isPending ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved ✓</span>}
      </div>
    </form>
  );
}

function TwilioConfigForm({
  flagKey,
  fromLabel,
  fromPlaceholder,
}: {
  flagKey: "SMS" | "WHATSAPP_NOTIFY";
  fromLabel: string;
  fromPlaceholder: string;
}) {
  const updateIntegration = useUpdateIntegration();

  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await updateIntegration.mutateAsync({
      key: flagKey,
      dto: { config: { accountSid, authToken, fromNumber } },
    });
    setAccountSid("");
    setAuthToken("");
    setFromNumber("");
    setSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-4 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        Messages are sent through Twilio. Sign in at{" "}
        <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-brand-green hover:underline">
          console.twilio.com
        </a>{" "}
        — the Account SID and Auth Token are on the first page.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`twilio-sid-${flagKey}`}>Account SID (starts with AC)</Label>
          <Input
            id={`twilio-sid-${flagKey}`}
            name={`twilio-sid-${flagKey}`}
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            placeholder="AC..."
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`twilio-token-${flagKey}`}>Auth Token</Label>
          <Input
            id={`twilio-token-${flagKey}`}
            name={`twilio-token-${flagKey}`}
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`twilio-from-${flagKey}`}>{fromLabel}</Label>
          <Input
            id={`twilio-from-${flagKey}`}
            name={`twilio-from-${flagKey}`}
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            placeholder={fromPlaceholder}
            autoComplete="off"
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Kept secret and locked away. For safety they won't be shown again after you save.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateIntegration.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateIntegration.isPending ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved ✓</span>}
      </div>
    </form>
  );
}

function ResendConfigForm() {
  const updateIntegration = useUpdateIntegration();

  const [apiKey, setApiKey] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await updateIntegration.mutateAsync({
      key: "EMAIL",
      dto: { config: { apiKey, fromAddress } },
    });
    setApiKey("");
    setFromAddress("");
    setSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-4 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        Emails are sent through Resend. Sign in at{" "}
        <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-brand-green hover:underline">
          resend.com
        </a>{" "}
        and create a key.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="resend-api-key">Resend key (starts with re_)</Label>
          <Input
            id="resend-api-key"
            name="resend-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="re_..."
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resend-from-address">Send emails from</Label>
          <Input
            id="resend-from-address"
            name="resend-from-address"
            type="email"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="notifications@yourorg.org"
            autoComplete="off"
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Kept secret and locked away. For safety they won't be shown again after you save.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateIntegration.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateIntegration.isPending ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved ✓</span>}
      </div>
    </form>
  );
}

function LookupsSettings() {
  const [category, setCategory] = useState<LookupCategory>("RELIGION");
  const [newValue, setNewValue] = useState("");
  const { data: values = [], isLoading, isError, error } = useLookups(category);
  const createLookup = useCreateLookup();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newValue.trim()) return;
    await createLookup.mutateAsync({ category, value: newValue.trim() });
    setNewValue("");
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <NativeSelect
          id="category"
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as LookupCategory)}
          options={LOOKUP_CATEGORIES.map((c) => ({ value: c, label: LOOKUP_CATEGORY_LABELS[c] }))}
        />
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="newLookupValue">Add a value</Label>
          <Input
            id="newLookupValue"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`e.g. a new ${LOOKUP_CATEGORY_LABELS[category]} option`}
          />
        </div>
        <Button
          type="submit"
          disabled={createLookup.isPending || !newValue.trim()}
          className="bg-brand-green hover:bg-brand-green/90"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </form>

      {isLoading && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading values...
        </p>
      )}
      {isError && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
          {error instanceof ApiError && error.status === 403
            ? "You don't have permission to manage lookup values."
            : "Failed to load values."}
        </p>
      )}
      {!isLoading && !isError && (
        <div className="space-y-2">
          {values.map((v) => (
            <LookupValueRow key={v.id} id={v.id} value={v.value} isActive={v.isActive} />
          ))}
          {values.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No values yet for {LOOKUP_CATEGORY_LABELS[category]}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LookupValueRow({ id, value, isActive }: { id: string; value: string; isActive: boolean }) {
  const updateLookup = useUpdateLookup();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || draft.trim() === value) {
      setEditing(false);
      return;
    }
    await updateLookup.mutateAsync({ id, dto: { value: draft.trim() } });
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={handleRename}
        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
      >
        <Input
          id="lookupRenameValue"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-9 flex-1"
        />
        <div className="flex gap-2">
          <Button type="submit" size="icon" variant="ghost" disabled={updateLookup.isPending}>
            <Check className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-4" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <span className={cn("font-medium", !isActive && "text-muted-foreground line-through")}>{value}</span>
      <div className="flex gap-2">
        <Button size="icon" variant="ghost" onClick={startEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={updateLookup.isPending}
          className={cn(isActive && "border-brand-green text-brand-green")}
          onClick={() => updateLookup.mutate({ id, dto: { isActive: !isActive } })}
        >
          {isActive ? "Active" : "Inactive"}
        </Button>
      </div>
    </div>
  );
}
