import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useOrgProfile, useUpdateOrg } from "@/hooks/useOrg";
import { useIntegrations, useUpdateIntegration } from "@/hooks/useIntegrations";
import { useCreateLookup, useLookups, useUpdateLookup } from "@/hooks/useLookups";
import { useReferralPointRules, useUpsertReferralPointRuleMatrix } from "@/hooks/useReferrals";
import { useAuthStore } from "@/stores/auth";
import {
  PLAN_TIER_ORDER,
  type FeatureFlagKey,
  type LookupCategory,
  type WithdrawalChargeType,
} from "@nmms/shared";

const PLAN_TIERS = PLAN_TIER_ORDER;

const REQUIRED_FIELD_BLANK_ERROR = "Please fill in all required fields — they can't be left blank.";

function hasBlankField(values: string[]): boolean {
  return values.some((v) => v.trim() === "");
}

const TABS = ["Organization", "Referral Program", "Withdrawals & KYC", "Integrations", "Lookups"] as const;

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

const INTEGRATION_INFO: Record<FeatureFlagKey, { label: string; description: string }> = {
  PAYMENT_GATEWAY: {
    label: "Payment Gateway",
    description: "Accept online membership payments via a card/UPI gateway.",
  },
  PAYMENT_GATEWAY_PAYOUTS: {
    label: "Payout Gateway (RazorpayX)",
    description: "Automatically send approved withdrawals via RazorpayX instead of marking them paid by hand.",
  },
  WHATSAPP_NOTIFY: {
    label: "WhatsApp Notifications",
    description: "Send approval, receipt, and expiry alerts over WhatsApp.",
  },
  AI_DEDUPE: {
    label: "AI Duplicate Detection",
    description: "Use AI to catch likely duplicate member registrations.",
  },
  AI_OCR: {
    label: "AI Document Verification",
    description: "Auto-extract and verify details from uploaded ID documents.",
  },
  SMS: { label: "SMS Notifications", description: "Send SMS alerts for approvals and renewals." },
  EMAIL: { label: "Email Notifications", description: "Send email receipts and renewal reminders." },
};

// Flags with an expandable credential form below the enable/disable toggle.
const CONFIGURABLE_INTEGRATION_KEYS = new Set<FeatureFlagKey>([
  "PAYMENT_GATEWAY",
  "PAYMENT_GATEWAY_PAYOUTS",
  "SMS",
  "WHATSAPP_NOTIFY",
  "EMAIL",
]);

export function Settings() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Organization");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage organization profile and integrations</p>
      </div>

      <div className="flex gap-2">
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
      {tab === "Integrations" && <IntegrationsSettings />}
      {tab === "Lookups" && <LookupsSettings />}
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
        <h2 className="mb-4 font-heading text-base font-semibold">Profile & Branding</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" {...field("name")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" {...field("logoUrl")} placeholder="/uploads/logo.png" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...field("address")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" type="email" {...field("contactEmail")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactPhone">Contact phone</Label>
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
        <h2 className="mb-4 font-heading text-base font-semibold">Number Formats</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Use <code>{"{PREFIX}"}</code>, <code>{"{YYYY}"}</code>, and <code>{"{SEQ}"}</code> as
          placeholders.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="membershipNumberFormat">Membership number format</Label>
            <Input id="membershipNumberFormat" {...field("membershipNumberFormat")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receiptNumberFormat">Receipt number format</Label>
            <Input id="receiptNumberFormat" {...field("receiptNumberFormat")} />
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
        {saved && <span className="text-sm text-brand-green">Saved.</span>}
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
              <h2 className="font-heading text-base font-semibold">Membership Referral Program</h2>
              <p className="text-sm text-muted-foreground">
                Let approved members refer others via a personal link and earn points.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(form.referralProgramEnabled && "border-brand-green text-brand-green")}
              onClick={() => setForm((f) => ({ ...f, referralProgramEnabled: !f.referralProgramEnabled }))}
            >
              {form.referralProgramEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-base font-semibold">Points & Volunteer Batches</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pointsPerApprovedReferral">Fallback points per approved referral</Label>
              <Input
                id="pointsPerApprovedReferral"
                type="number"
                min="0"
                value={form.pointsPerApprovedReferral}
                onChange={(e) => setForm((f) => ({ ...f, pointsPerApprovedReferral: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Used when the referral point matrix below has no cell for the two members' plan tiers.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="donationPointsPercent">Donation reward — % of amount</Label>
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
          <h2 className="mb-1 font-heading text-base font-semibold">Referral Eligibility & Cap</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Optional guardrails on who can earn referral points and how much.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="referralPointsCapPerMember">Lifetime cap per referrer (points)</Label>
              <Input
                id="referralPointsCapPerMember"
                type="number"
                min="0"
                placeholder="No limit"
                value={form.referralPointsCapPerMember}
                onChange={(e) => setForm((f) => ({ ...f, referralPointsCapPerMember: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leave blank for no cap.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Referrer must have an active plan</Label>
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
          <h2 className="mb-1 font-heading text-base font-semibold">Points → Money Conversion</h2>
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
          {saved && <span className="text-sm text-brand-green">Saved.</span>}
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
      <h2 className="mb-1 font-heading text-base font-semibold">Referral Points Matrix</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Points a referrer earns based on their own plan tier (rows) and the referred member's plan tier
        (columns). Blank cells fall back to the flat rate above.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading matrix...</p>
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
        <h2 className="mb-1 font-heading text-base font-semibold">KYC Requirements</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Full Name and Mobile are always required. Toggle which additional pieces must be on file before a
          member's KYC can be verified.
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
        {saved && <span className="text-sm text-brand-green">Saved.</span>}
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
      {flags.map((flag) => {
        const info = INTEGRATION_INFO[flag.key];
        return (
          <div key={flag.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{info.label}</span>
                  {flag.hasConfig && (
                    <Badge variant="outline" className="border-transparent bg-muted text-xs text-muted-foreground">
                      Configured
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{info.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {CONFIGURABLE_INTEGRATION_KEYS.has(flag.key) && (
                  <Button size="sm" variant="ghost" onClick={() => setExpandedKey((k) => (k === flag.key ? null : flag.key))}>
                    Configure
                    {expandedKey === flag.key ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateIntegration.isPending}
                  className={cn(flag.enabled && "border-brand-green text-brand-green")}
                  onClick={() =>
                    updateIntegration.mutate({ key: flag.key, dto: { enabled: !flag.enabled } })
                  }
                >
                  {flag.enabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </div>
            {flag.key === "PAYMENT_GATEWAY" && expandedKey === "PAYMENT_GATEWAY" && <PaymentGatewayConfigForm />}
            {flag.key === "PAYMENT_GATEWAY_PAYOUTS" && expandedKey === "PAYMENT_GATEWAY_PAYOUTS" && (
              <PayoutGatewayConfigForm />
            )}
            {flag.key === "SMS" && expandedKey === "SMS" && (
              <TwilioConfigForm flagKey="SMS" fromLabel="From Number" fromPlaceholder="+15551234567" />
            )}
            {flag.key === "WHATSAPP_NOTIFY" && expandedKey === "WHATSAPP_NOTIFY" && (
              <TwilioConfigForm
                flagKey="WHATSAPP_NOTIFY"
                fromLabel="WhatsApp From Number"
                fromPlaceholder="+15551234567"
              />
            )}
            {flag.key === "EMAIL" && expandedKey === "EMAIL" && <ResendConfigForm />}
          </div>
        );
      })}
    </div>
  );
}

function PaymentGatewayConfigForm() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const updateIntegration = useUpdateIntegration();

  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saved, setSaved] = useState(false);

  const webhookUrl = organizationId
    ? `${window.location.origin}/api/v1/webhooks/razorpay/${organizationId}`
    : "";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await updateIntegration.mutateAsync({
      key: "PAYMENT_GATEWAY",
      dto: { config: { keyId, keySecret, webhookSecret } },
    });
    setKeyId("");
    setKeySecret("");
    setWebhookSecret("");
    setSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-4 border-t border-border pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rzp-key-id">Key ID</Label>
          <Input
            id="rzp-key-id"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_live_..."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rzp-key-secret">Key Secret</Label>
          <Input
            id="rzp-key-secret"
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rzp-webhook-secret">Webhook Secret</Label>
          <Input
            id="rzp-webhook-secret"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="From Razorpay Dashboard → Webhooks"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Webhook URL — paste this into Razorpay Dashboard → Webhooks</Label>
        <Input readOnly value={webhookUrl} className="bg-muted font-mono text-xs" />
      </div>

      <p className="text-xs text-muted-foreground">
        Credentials are encrypted at rest and are write-only — they won't be shown again after saving.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateIntegration.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateIntegration.isPending ? "Saving…" : "Save Credentials"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved.</span>}
      </div>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-key-id">Key ID</Label>
          <Input
            id="rzpx-key-id"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_live_..."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-key-secret">Key Secret</Label>
          <Input
            id="rzpx-key-secret"
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-account-number">RazorpayX Account Number</Label>
          <Input
            id="rzpx-account-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="The virtual account payouts are sent from"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rzpx-webhook-secret">Webhook Secret</Label>
          <Input
            id="rzpx-webhook-secret"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="From Razorpay Dashboard → Webhooks"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Webhook URL — paste this into Razorpay Dashboard → Webhooks</Label>
        <Input readOnly value={webhookUrl} className="bg-muted font-mono text-xs" />
      </div>

      <p className="text-xs text-muted-foreground">
        Credentials are encrypted at rest and are write-only — they won't be shown again after saving.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateIntegration.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateIntegration.isPending ? "Saving…" : "Save Credentials"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved.</span>}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`twilio-sid-${flagKey}`}>Twilio Account SID</Label>
          <Input
            id={`twilio-sid-${flagKey}`}
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            placeholder="AC..."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`twilio-token-${flagKey}`}>Auth Token</Label>
          <Input
            id={`twilio-token-${flagKey}`}
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`twilio-from-${flagKey}`}>{fromLabel}</Label>
          <Input
            id={`twilio-from-${flagKey}`}
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            placeholder={fromPlaceholder}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Credentials are encrypted at rest and are write-only — they won't be shown again after saving.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateIntegration.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateIntegration.isPending ? "Saving…" : "Save Credentials"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved.</span>}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="resend-api-key">Resend API Key</Label>
          <Input
            id="resend-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="re_..."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resend-from-address">From Address</Label>
          <Input
            id="resend-from-address"
            type="email"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="notifications@yourorg.org"
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Credentials are encrypted at rest and are write-only — they won't be shown again after saving.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateIntegration.isPending} className="bg-brand-green hover:bg-brand-green/90">
          {updateIntegration.isPending ? "Saving…" : "Save Credentials"}
        </Button>
        {saved && <span className="text-sm text-brand-green">Saved.</span>}
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
