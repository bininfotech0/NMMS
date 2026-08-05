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
import { useAuthStore } from "@/stores/auth";
import type { FeatureFlagKey, LookupCategory } from "@nmms/shared";

const TABS = ["Organization", "Referral Program", "Integrations", "Lookups"] as const;

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
            <Input id="bankIfscCode" {...field("bankIfscCode")} />
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
    referralSilverMinPoints: "0",
    referralGoldMinPoints: "500",
    referralPlatinumMinPoints: "2000",
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    setForm({
      referralProgramEnabled: org.referralProgramEnabled,
      pointsPerApprovedReferral: String(org.pointsPerApprovedReferral),
      referralSilverMinPoints: String(org.referralSilverMinPoints),
      referralGoldMinPoints: String(org.referralGoldMinPoints),
      referralPlatinumMinPoints: String(org.referralPlatinumMinPoints),
    });
  }, [org]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    try {
      await updateOrg.mutateAsync({
        referralProgramEnabled: form.referralProgramEnabled,
        pointsPerApprovedReferral: Number(form.pointsPerApprovedReferral),
        referralSilverMinPoints: Number(form.referralSilverMinPoints),
        referralGoldMinPoints: Number(form.referralGoldMinPoints),
        referralPlatinumMinPoints: Number(form.referralPlatinumMinPoints),
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

  return (
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
        <h2 className="mb-4 font-heading text-base font-semibold">Points & Ranks</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pointsPerApprovedReferral">Points per approved referral</Label>
            <Input
              id="pointsPerApprovedReferral"
              type="number"
              min="0"
              value={form.pointsPerApprovedReferral}
              onChange={(e) => setForm((f) => ({ ...f, pointsPerApprovedReferral: e.target.value }))}
            />
          </div>
          <div />
          <div className="space-y-1.5">
            <Label htmlFor="referralSilverMinPoints">Silver rank — minimum points</Label>
            <Input
              id="referralSilverMinPoints"
              type="number"
              min="0"
              value={form.referralSilverMinPoints}
              onChange={(e) => setForm((f) => ({ ...f, referralSilverMinPoints: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referralGoldMinPoints">Gold rank — minimum points</Label>
            <Input
              id="referralGoldMinPoints"
              type="number"
              min="0"
              value={form.referralGoldMinPoints}
              onChange={(e) => setForm((f) => ({ ...f, referralGoldMinPoints: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referralPlatinumMinPoints">Platinum rank — minimum points</Label>
            <Input
              id="referralPlatinumMinPoints"
              type="number"
              min="0"
              value={form.referralPlatinumMinPoints}
              onChange={(e) => setForm((f) => ({ ...f, referralPlatinumMinPoints: e.target.value }))}
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          A member's rank is recalculated from these thresholds every time they're viewed — changing a
          threshold re-ranks everyone immediately.
        </p>
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
                {flag.key === "PAYMENT_GATEWAY" && (
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
