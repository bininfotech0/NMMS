import { Outlet, useNavigate, NavLink } from "react-router-dom";
import {
  Award,
  CalendarDays,
  CreditCard,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Share2,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Shell } from "@/components/layout/shell/Shell";
import type { ShellNavSection } from "@/components/layout/shell/types";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { useMemberAuthStore } from "@/stores/member-auth";
import { logoutMember } from "@/lib/member-auth";
import { useMyReferralSummary } from "@/hooks/useReferrals";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMyPhotoUrl } from "@/hooks/useMyDocuments";
import { getInitials, cn } from "@/lib/utils";
import { computeVolunteerBatch } from "@/lib/volunteer-batch";
import { isMemberActive, memberStatusInfo } from "@/lib/member-status";

// Ordered by what a beginner member looks for most — the first five become
// the mobile bottom bar (Shell's MAX_BOTTOM_TABS), the rest go under "More".
const ACTIVE_ITEMS: ShellNavSection["items"] = [
  { key: "dashboard", to: "/member", label: "Home", icon: LayoutDashboard, end: true },
  { key: "card", to: "/member/card", label: "My Card", icon: CreditCard },
  { key: "events", to: "/member/events", label: "Events", icon: CalendarDays },
  { key: "payments", to: "/member/payments", label: "Payments", icon: Receipt },
  { key: "referrals", to: "/member/referrals", label: "Refer & Earn", icon: Share2, shortLabel: "Refer" },
  { key: "notices", to: "/member/notices", label: "Notices", icon: Megaphone },
  { key: "wallet", to: "/member/wallet", label: "Wallet", icon: Wallet },
  { key: "kyc", to: "/member/kyc", label: "Bank details", icon: ShieldCheck },
  { key: "rewards", to: "/member/rewards", label: "Rewards", icon: Award },
  { key: "donations", to: "/member/donations", label: "Donations", icon: HeartHandshake },
  { key: "documents", to: "/member/documents", label: "Documents", icon: FileText },
  { key: "profile", to: "/member/profile", label: "Profile", icon: UserRound },
];

// Until the membership is active, only what's needed to finish joining —
// the other pages don't apply yet and would only distract.
const JOINING_ITEMS: ShellNavSection["items"] = [
  { key: "dashboard", to: "/member", label: "Home", icon: LayoutDashboard, end: true },
  { key: "notices", to: "/member/notices", label: "Notices", icon: Megaphone },
  { key: "profile", to: "/member/profile", label: "Profile", icon: UserRound },
];

export function MemberPortalLayout() {
  const navigate = useNavigate();
  const storeMember = useMemberAuthStore((state) => state.member);
  // Prefer the live profile over the login-time store snapshot so a plan/status
  // change made by staff is reflected without waiting for a token refresh —
  // see MemberDashboard for the same pattern.
  const { data: profile } = useMyProfile();
  // Fetched once here (not per-page) so the wallet pill's points balance
  // stays in sync everywhere in the portal, not just on Dashboard.
  const { data: summary } = useMyReferralSummary();
  const photoUrl = useMyPhotoUrl();

  async function handleLogout() {
    await logoutMember();
    navigate("/login");
  }

  if (!storeMember) return null;
  const member = profile ?? storeMember;
  const isActive = isMemberActive(member.status);
  // An ended membership can still look up past receipts while renewing.
  const items = isActive
    ? ACTIVE_ITEMS
    : member.status === "EXPIRED"
      ? [...JOINING_ITEMS.slice(0, 2), ACTIVE_ITEMS.find((i) => i.key === "payments")!, ...JOINING_ITEMS.slice(2)]
      : JOINING_ITEMS;
  const sections: ShellNavSection[] = [{ label: "", items }];
  // Derived from planTier (same field the dashboard's "Your plan" card
  // reads) rather than summary.batch, so the header badge can't disagree
  // with the plan shown elsewhere in the portal — see MemberDashboard.
  const batch = computeVolunteerBatch(member.planTier);

  return (
    <Shell
      density="tabs"
      brandSlot={
        <>
          <Logo variant="icon" size={30} className="sm:hidden" />
          <Logo variant="stacked" size={32} className="hidden sm:flex" />
        </>
      }
      sections={sections}
      userLabel={member.fullName}
      userSubtitle={
        isActive && batch ? (
          <VolunteerBatchBadge batch={batch} className="mt-0.5" />
        ) : (
          <p className="text-xs text-muted-foreground">{memberStatusInfo(member.status).label}</p>
        )
      }
      userInitials={getInitials(member.fullName)}
      userAvatarUrl={photoUrl}
      onLogout={handleLogout}
      headerExtras={
        isActive && (
          <NavLink
            to="/member/wallet"
            className={({ isActive: linkActive }) =>
              cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                linkActive
                  ? "border-brand-green bg-brand-bg-soft text-brand-green"
                  : "border-border text-muted-foreground hover:border-brand-green hover:text-brand-green",
              )
            }
          >
            <Wallet className="size-4" />
            <span className="hidden sm:inline">{summary ? `${summary.pointsBalance} pts` : "Wallet"}</span>
          </NavLink>
        )
      }
    >
      <Outlet />
    </Shell>
  );
}
