import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft, IdCard, Pencil, Printer, Phone, Mail,
  MapPin, Calendar, User, Users, Award, Shield, Activity,
  FileText, CreditCard, Clock, MapPinned, Share2, Copy,
  Ban, RotateCcw, HeartCrack, UserCog, Trash2, TrendingUp, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { computeVolunteerBatch } from "@/lib/volunteer-batch";
import {
  useDeleteMember,
  useMember,
  useMemberDocuments,
  useMemberPayments,
  useMemberStatusHistory,
  usePromoteToExecutive,
  useResetMemberPassword,
  useUpgradeMemberPlan,
} from "@/hooks/useMembers";
import { useReactivateMember, useSuspendMember, useMarkMemberDeceased } from "@/hooks/useApplications";
import { useGenerateReferralCode, useReferralNetwork } from "@/hooks/useReferrals";
import { usePlans } from "@/hooks/usePlans";
import { useAuthStore } from "@/stores/auth";
import { PLAN_TIER_ORDER, Role, type MemberResponse, type PaymentMode, type PlanTier } from "@nmms/shared";

const CAN_MANAGE_LIFECYCLE = [Role.ADMIN, Role.SUPER_ADMIN];

type LifecycleAction = "suspend" | "reactivate" | "mark-deceased";

const LIFECYCLE_COPY: Record<LifecycleAction, { title: string; description: string; confirmLabel: string }> = {
  suspend: {
    title: "Suspend member",
    description: "The member will no longer be counted as active until reactivated.",
    confirmLabel: "Suspend",
  },
  reactivate: {
    title: "Reactivate member",
    description: "Restores the member to Active status.",
    confirmLabel: "Reactivate",
  },
  "mark-deceased": {
    title: "Mark member as deceased",
    description: "This is a terminal status and cannot be reversed.",
    confirmLabel: "Mark Deceased",
  },
};

function LifecycleActionSheet({
  member,
  action,
  onOpenChange,
}: {
  member: MemberResponse | null;
  action: LifecycleAction | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const suspend = useSuspendMember();
  const reactivate = useReactivateMember();
  const markDeceased = useMarkMemberDeceased();
  const mutation = action === "suspend" ? suspend : action === "reactivate" ? reactivate : markDeceased;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setError(null);
    try {
      await mutation.mutateAsync({ memberId: member.id, remarks });
      setRemarks("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  const copy = action ? LIFECYCLE_COPY[action] : null;

  return (
    <Sheet
      open={action !== null}
      onOpenChange={(next) => {
        if (!next) {
          setRemarks("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{copy?.title}</SheetTitle>
          <SheetDescription>{copy?.description}</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="lifecycle-remarks">Remarks</Label>
            <Input id="lifecycle-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              variant={action === "mark-deceased" ? "destructive" : "default"}
              className={action !== "mark-deceased" ? "bg-brand-green hover:bg-brand-green/90" : undefined}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Working…" : copy?.confirmLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function PromoteToExecutiveSheet({
  member,
  open,
  onOpenChange,
}: {
  member: MemberResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const promote = usePromoteToExecutive();

  function reset() {
    setEmail("");
    setPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await promote.mutateAsync({ id: member.id, dto: { email, password } });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Promote to Field Executive</SheetTitle>
          <SheetDescription>
            {member.fullName} keeps their existing member login — this adds a separate staff account so
            they can log into the admin panel and register other members door-to-door.
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="promote-email">Staff login email</Label>
            <Input
              id="promote-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promote-password">Temporary password</Label>
            <Input
              id="promote-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={promote.isPending} className="bg-brand-green hover:bg-brand-green/90">
              {promote.isPending ? "Promoting…" : "Promote"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "BANK", "CHEQUE"];

// Admin/staff-only tier upgrade (e.g. Silver → Gold) for an ACTIVE member —
// charges the fee difference between the current plan and the target plan.
// See PaymentsService.upgradePlan for the server-side charge/CAS logic.
function UpgradePlanSheet({
  member,
  open,
  onOpenChange,
}: {
  member: MemberResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: plans = [] } = usePlans();
  const upgradePlan = useUpgradeMemberPlan();
  const [planId, setPlanId] = useState("");
  const [mode, setMode] = useState<Exclude<PaymentMode, "ONLINE">>("CASH");
  const [transactionNumber, setTransactionNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentTierIndex = member.planTier ? PLAN_TIER_ORDER.indexOf(member.planTier as PlanTier) : -1;
  const eligiblePlans = plans.filter(
    (plan) =>
      plan.isActive &&
      plan.id !== member.planId &&
      (!plan.tier || currentTierIndex === -1 || PLAN_TIER_ORDER.indexOf(plan.tier) > currentTierIndex),
  );
  const selectedPlan = eligiblePlans.find((plan) => plan.id === planId);
  const currentFee = member.feeOverride ?? plans.find((p) => p.id === member.planId)?.fee ?? 0;
  const amount = selectedPlan ? Math.max(selectedPlan.fee - currentFee, 0) : null;

  function reset() {
    setPlanId("");
    setMode("CASH");
    setTransactionNumber("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await upgradePlan.mutateAsync({
        id: member.id,
        dto: { planId, mode, transactionNumber: transactionNumber || undefined },
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Upgrade Plan</SheetTitle>
          <SheetDescription>
            Move {member.fullName} to a higher membership tier. Their earning rate changes to the new plan's rate
            immediately.
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-plan">New plan</Label>
            <select
              id="upgrade-plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              required
            >
              <option value="">Select a plan…</option>
              {eligiblePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} {plan.tier ? `(${plan.tier.charAt(0)}${plan.tier.slice(1).toLowerCase()})` : ""} — ₹
                  {plan.fee}
                </option>
              ))}
            </select>
            {eligiblePlans.length === 0 && (
              <p className="text-xs text-muted-foreground">No higher-tier active plans available.</p>
            )}
          </div>
          {amount !== null && (
            <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee difference to collect</span>
                <span className="font-medium">₹{amount}</span>
              </div>
              {amount === 0 && <p className="text-xs text-muted-foreground">No payment required.</p>}
            </div>
          )}
          {amount !== null && amount > 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="upgrade-mode">Payment mode</Label>
                <select
                  id="upgrade-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Exclude<PaymentMode, "ONLINE">)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0) + m.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="upgrade-transactionNumber">Transaction reference (optional)</Label>
                <Input
                  id="upgrade-transactionNumber"
                  value={transactionNumber}
                  onChange={(e) => setTransactionNumber(e.target.value)}
                />
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={upgradePlan.isPending || !planId}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {upgradePlan.isPending ? "Upgrading…" : "Upgrade Plan"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ResetMemberPasswordSheet({
  member,
  open,
  onOpenChange,
}: {
  member: MemberResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const resetPassword = useResetMemberPassword();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await resetPassword.mutateAsync({ id: member.id, newPassword });
      setSuccess(true);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSuccess(false);
          setError(null);
          setNewPassword("");
        }
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Reset Password</SheetTitle>
          <SheetDescription>Setting a new member-portal password for {member.fullName}.</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {success && <p className="text-sm text-brand-green">Password updated successfully.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={resetPassword.isPending}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {resetPassword.isPending ? "Saving…" : "Set New Password"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function formatDate(d: Date | string | null, fmt?: string): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  if (fmt === "dd/MM/yyyy") return `${day}/${month}/${year}`;
  return date.toLocaleDateString("en-IN");
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground min-w-[80px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function StatusTimeline({ history }: { history: Array<{ fromStatus: string; toStatus: string; createdAt: string; actor?: { id?: string; fullName?: string } | null }> }) {
  return (
    <div className="space-y-3">
      {history.map((h, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="size-2 rounded-full bg-brand-green" />
            {i < history.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={h.fromStatus} />
              <span className="text-xs text-muted-foreground">→</span>
              <StatusBadge status={h.toStatus} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {h.actor?.fullName ?? "System"} · {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

type Tab = "overview" | "address" | "documents" | "payments" | "referrals" | "history";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: User },
  { key: "address", label: "Address", icon: MapPin },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "referrals", label: "Referrals", icon: Share2 },
  { key: "history", label: "Timeline", icon: Activity },
];

const REFERRAL_SHARE_MESSAGE = "Join our membership program using this referral link:";

function ReferralsTab({ member }: { member: MemberResponse }) {
  const { data: network, isLoading } = useReferralNetwork(member.status === "ACTIVE" ? member.id : null);
  const { data: referrer } = useMember(member.referralMemberId);
  const batch = computeVolunteerBatch(member.planTier);
  const user = useAuthStore((state) => state.user);
  const generateCode = useGenerateReferralCode();

  const referralLink = member.referralCode
    ? `${window.location.origin}/join?ref=${member.referralCode}`
    : null;

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  }

  async function shareLink() {
    if (!referralLink) return;
    // Native share sheet where supported — falls back to a pre-filled
    // WhatsApp chat, matching the member portal's own share behaviour.
    if (navigator.share) {
      try {
        await navigator.share({ text: REFERRAL_SHARE_MESSAGE, url: referralLink });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error("Couldn't open the share sheet");
        }
      }
      return;
    }
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${REFERRAL_SHARE_MESSAGE} ${referralLink}`)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <SectionCard title="Referral Summary">
        {member.referralCode ? (
          <Detail icon={IdCard} label="Referral Code" value={member.referralCode} />
        ) : member.status === "ACTIVE" && user && CAN_MANAGE_LIFECYCLE.includes(user.role) ? (
          <div className="flex items-center gap-2 text-sm">
            <IdCard className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-[80px] text-muted-foreground">Referral Code:</span>
            <span className="font-medium">Not generated yet</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-1"
              disabled={generateCode.isPending}
              onClick={() => generateCode.mutate(member.id)}
            >
              {generateCode.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
        ) : (
          <Detail
            icon={IdCard}
            label="Referral Code"
            value={member.status === "ACTIVE" ? "Not generated yet" : "Available once ACTIVE"}
          />
        )}
        {referralLink && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="flex-1 truncate text-sm">{referralLink}</span>
              <Button variant="ghost" size="sm" onClick={copyLink}>
                <Copy className="mr-1.5 size-4" />
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={shareLink}>
                <Share2 className="mr-1.5 size-4" />
                Share
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone who joins through this link is automatically credited to {member.fullName.split(" ")[0]}.
            </p>
          </div>
        )}
        <Detail icon={Award} label="Points Balance" value={String(member.referralPointsBalance)} />
        <div className="flex items-center gap-2 text-sm">
          <Award className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-[80px] text-muted-foreground">Volunteer Batch:</span>
          <VolunteerBatchBadge batch={batch} />
        </div>
        {member.referralMemberId && <Detail icon={User} label="Referred By" value={referrer?.fullName ?? member.referralMemberId} />}
      </SectionCard>

      <SectionCard title="People Referred">
        {member.status !== "ACTIVE" ? (
          <p className="text-sm text-muted-foreground">Referral tracking starts once this member is ACTIVE.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !network || network.children.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has joined through this member's referral link yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {network.children.map((child) => (
              <li key={child.memberId} className="flex items-center justify-between py-2 text-sm">
                <Link to={`/admin/members/${child.memberId}/profile`} className="font-medium hover:underline">
                  {child.fullName}
                </Link>
                <StatusBadge status={child.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

export function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [upgradePlanOpen, setUpgradePlanOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

  const { data: member, isLoading } = useMember(id ?? null);
  const { data: documents = [] } = useMemberDocuments(id ?? null);
  const { data: payments = [] } = useMemberPayments(id ?? null);
  const { data: statusHistory = [] } = useMemberStatusHistory(id ?? null);
  const user = useAuthStore((state) => state.user);
  const deleteMember = useDeleteMember();

  if (!id) return null;

  if (isLoading || !member) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading member...</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/members"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to Members
          </Link>
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-brand-green text-white text-sm">
                {initials(member.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-bold">{member.fullName}</h1>
                <StatusBadge status={member.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {member.membershipNumber ?? "No membership number yet"}
                {member.planId && " · Member"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {(member.status === "DRAFT" || member.status === "PAYMENT_COLLECTED") && (
            <Button variant="outline" asChild>
              <Link to={`/admin/members/${id}/wizard`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
          )}
          {(member.status === "ACTIVE" ||
            member.status === "SUSPENDED" ||
            member.status === "EXPIRED" ||
            member.status === "RENEWED" ||
            member.status === "SUBMITTED" ||
            member.status === "APPROVED") &&
            user &&
            (CAN_MANAGE_LIFECYCLE.includes(user.role) || member.createdById === user.id) && (
              <Button variant="outline" asChild>
                <Link to={`/admin/members/${id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            )}
          {user && (CAN_MANAGE_LIFECYCLE.includes(user.role) || member.createdById === user.id) && (
            <Button variant="outline" onClick={() => setResetPasswordOpen(true)}>
              <KeyRound className="size-4" />
              Reset Password
            </Button>
          )}
          {member.membershipNumber && (
            <Button variant="outline" asChild>
              <Link to={`/admin/members/${id}/card`}>
                <IdCard className="size-4" />
                View Card
              </Link>
            </Button>
          )}
          {member.status === "DRAFT" &&
            user &&
            (CAN_MANAGE_LIFECYCLE.includes(user.role) || member.createdById === user.id) && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          {user &&
            CAN_MANAGE_LIFECYCLE.includes(user.role) &&
            member.status === "ACTIVE" &&
            !member.promotedToUserId && (
              <Button variant="outline" onClick={() => setPromoteOpen(true)}>
                <UserCog className="size-4" />
                Promote to Field Executive
              </Button>
            )}
          {user && CAN_MANAGE_LIFECYCLE.includes(user.role) && member.status === "ACTIVE" && (
            <Button variant="outline" onClick={() => setUpgradePlanOpen(true)}>
              <TrendingUp className="size-4" />
              Upgrade Plan
            </Button>
          )}
          {user && CAN_MANAGE_LIFECYCLE.includes(user.role) && member.status === "ACTIVE" && (
            <Button variant="outline" onClick={() => setLifecycleAction("suspend")}>
              <Ban className="size-4" />
              Suspend
            </Button>
          )}
          {user && CAN_MANAGE_LIFECYCLE.includes(user.role) && member.status === "SUSPENDED" && (
            <Button variant="outline" onClick={() => setLifecycleAction("reactivate")}>
              <RotateCcw className="size-4" />
              Reactivate
            </Button>
          )}
          {user &&
            CAN_MANAGE_LIFECYCLE.includes(user.role) &&
            (member.status === "ACTIVE" || member.status === "SUSPENDED") && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setLifecycleAction("mark-deceased")}
              >
                <HeartCrack className="size-4" />
                Mark Deceased
              </Button>
            )}
          <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {TABS.map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TabIcon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Personal Information">
            <Detail icon={User} label="Full Name" value={member.fullName} />
            <Detail icon={User} label="Gender" value={member.gender ? member.gender.charAt(0) + member.gender.slice(1).toLowerCase() : null} />
            <Detail icon={Calendar} label="Date of Birth" value={member.dob ? formatDate(member.dob, "dd/MM/yyyy") : null} />
            <Detail icon={Users} label="Marital Status" value={member.maritalStatus ? member.maritalStatus.charAt(0) + member.maritalStatus.slice(1).toLowerCase() : null} />
            <Detail icon={Award} label="Blood Group" value={member.bloodGroup} />
            {member.fatherName && <Detail icon={User} label="Father's Name" value={member.fatherName} />}
            {member.motherName && <Detail icon={User} label="Mother's Name" value={member.motherName} />}
          </SectionCard>

          <SectionCard title="Contact Information">
            <Detail icon={Phone} label="Mobile" value={member.mobile} />
            {member.whatsappNumber && <Detail icon={Phone} label="WhatsApp" value={member.whatsappNumber} />}
            {member.email && <Detail icon={Mail} label="Email" value={member.email} />}
            {member.emergencyContactName && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Emergency Contact</p>
                <Detail icon={User} label="Name" value={member.emergencyContactName} />
                <Detail icon={Phone} label="Mobile" value={member.emergencyContactMobile} />
                {member.emergencyContactRelationship && <Detail icon={Users} label="Relationship" value={member.emergencyContactRelationship} />}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Membership">
            <Detail icon={IdCard} label="Member ID" value={member.membershipNumber} />
            <Detail
              icon={CreditCard}
              label="Plan"
              value={
                member.planName
                  ? member.planTier
                    ? `${member.planName} (${member.planTier.charAt(0)}${member.planTier.slice(1).toLowerCase()})`
                    : member.planName
                  : null
              }
            />
            {member.joiningDate && <Detail icon={Calendar} label="Joined" value={formatDate(member.joiningDate, "dd/MM/yyyy")} />}
            {member.validUntil && <Detail icon={Clock} label="Valid Until" value={formatDate(member.validUntil, "dd/MM/yyyy")} />}
            <Detail icon={Shield} label="Status" value={member.status} />
          </SectionCard>

          <SectionCard title="Identity Documents">
            {member.aadhaarLast4 && <Detail icon={Shield} label="Aadhaar" value={`XXXX-XXXX-${member.aadhaarLast4}`} />}
            {member.pan && <Detail icon={FileText} label="PAN" value={member.pan} />}
            {member.voterId && <Detail icon={FileText} label="Voter ID" value={member.voterId} />}
            {!member.aadhaarLast4 && !member.pan && !member.voterId && (
              <p className="text-sm text-muted-foreground">No identity documents provided</p>
            )}
          </SectionCard>

          <SectionCard title="KYC & Payout">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-[80px] text-muted-foreground">KYC Status:</span>
              <Badge
                className={cn(
                  "border-transparent font-medium",
                  member.kycStatus === "VERIFIED" && "bg-emerald-100 text-emerald-700",
                  member.kycStatus === "PENDING" && "bg-amber-100 text-amber-700",
                  member.kycStatus === "REJECTED" && "bg-red-100 text-red-700",
                  member.kycStatus === "NOT_SUBMITTED" && "bg-muted text-muted-foreground",
                )}
              >
                {member.kycStatus.replace(/_/g, " ")}
              </Badge>
            </div>
            <Detail
              icon={Award}
              label="Converted"
              value={`${member.pointsConverted} pts`}
            />
            <Detail icon={CreditCard} label="Withdrawn" value={`₹${member.totalWithdrawnAmount}`} />
            {member.kycStatus !== "NOT_SUBMITTED" && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/admin/kyc?member=${member.id}`}>Review in KYC queue</Link>
              </Button>
            )}
          </SectionCard>

          {member.educationId && (
            <SectionCard title="Education & Occupation">
              <Detail icon={Award} label="Education" value={member.educationId ?? ""} />
              {member.occupationId && <Detail icon={Award} label="Occupation" value={member.occupationId ?? ""} />}
              {member.qualificationDetail && <Detail icon={Award} label="Qualification" value={member.qualificationDetail} />}
            </SectionCard>
          )}

          <SectionCard title="Additional Information">
            {member.isDifferentlyAbled && <Badge variant="secondary">Differently Abled</Badge>}
            {member.isExServiceman && <Badge variant="secondary">Ex-Serviceman</Badge>}
            {member.isSeniorCitizen && <Badge variant="secondary">Senior Citizen</Badge>}
            {!member.isDifferentlyAbled && !member.isExServiceman && !member.isSeniorCitizen && (
              <p className="text-sm text-muted-foreground">None</p>
            )}
            {member.skills.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {member.skills.map((skill) => (
                    <Badge key={skill} variant="outline">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === "address" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Current Address">
            <Detail icon={MapPinned} label="Address" value={member.addressLine} />
            {member.pincode && <Detail icon={MapPin} label="Pincode" value={member.pincode} />}
          </SectionCard>
          <SectionCard title="Permanent Address">
            {member.sameAsCurrentAddress ? (
              <p className="text-sm text-muted-foreground">Same as current address</p>
            ) : (
              <>
                <Detail icon={MapPinned} label="Address" value={member.permAddressLine} />
                {member.permPincode && <Detail icon={MapPin} label="Pincode" value={member.permPincode} />}
              </>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === "documents" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Documents ({documents.length})</CardTitle>
            {(member.status === "ACTIVE" ||
              member.status === "SUSPENDED" ||
              member.status === "EXPIRED" ||
              member.status === "RENEWED" ||
              member.status === "SUBMITTED" ||
              member.status === "APPROVED") &&
              user &&
              CAN_MANAGE_LIFECYCLE.includes(user.role) && (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/admin/members/${id}/edit`}>
                    <Pencil className="size-4" />
                    Manage Documents
                  </Link>
                </Button>
              )}
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc: { id: string; type: string; fileName: string; mimeType: string; createdAt: string }) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <FileText className="size-8 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">{doc.type.replace(/_/g, " ")} · {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "payments" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Payment History ({payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">₹{payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{payment.mode} · {payment.receiptNumber}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.paidAt).toLocaleDateString("en-IN")}
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/members/${id}/payments/${payment.id}/receipt`}>
                          <Printer className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "referrals" && <ReferralsTab member={member} />}

      {activeTab === "history" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Status Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {statusHistory.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No status changes recorded</p>
            ) : (
              <StatusTimeline history={statusHistory} />
            )}
          </CardContent>
        </Card>
      )}

      <LifecycleActionSheet
        member={member}
        action={lifecycleAction}
        onOpenChange={(open) => !open && setLifecycleAction(null)}
      />
      <PromoteToExecutiveSheet member={member} open={promoteOpen} onOpenChange={setPromoteOpen} />
      <UpgradePlanSheet member={member} open={upgradePlanOpen} onOpenChange={setUpgradePlanOpen} />
      <ResetMemberPasswordSheet member={member} open={resetPasswordOpen} onOpenChange={setResetPasswordOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete draft?"
        description={`This permanently deletes ${member.fullName} and any documents/nominee details saved so far. This cannot be undone.`}
        confirmLabel="Delete"
        isPending={deleteMember.isPending}
        onConfirm={() => {
          deleteMember.mutate(id, {
            onSuccess: () => navigate("/admin/members"),
          });
        }}
      />
    </div>
  );
}
