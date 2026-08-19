import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { Award, CalendarDays, LayoutDashboard, Share2, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Shell } from "@/components/layout/shell/Shell";
import type { ShellNavSection } from "@/components/layout/shell/types";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { useMemberAuthStore } from "@/stores/member-auth";
import { logoutMember } from "@/lib/member-auth";
import { useMyReferralSummary } from "@/hooks/useReferrals";
import { useMyProfile } from "@/hooks/useMyProfile";
import { getInitials, cn } from "@/lib/utils";
import { computeVolunteerBatch } from "@/lib/volunteer-batch";

const SECTIONS: ShellNavSection[] = [
  {
    label: "",
    items: [
      { key: "dashboard", to: "/member", label: "Dashboard", icon: LayoutDashboard, end: true },
      { key: "referrals", to: "/member/referrals", label: "My Referrals", icon: Share2, shortLabel: "Referrals" },
      { key: "events", to: "/member/events", label: "Events", icon: CalendarDays },
      { key: "wallet", to: "/member/wallet", label: "Wallet", icon: Wallet },
      { key: "rewards", to: "/member/rewards", label: "Rewards", icon: Award },
      { key: "kyc", to: "/member/kyc", label: "KYC", icon: ShieldCheck },
      { key: "profile", to: "/member/profile", label: "Profile", icon: UserRound },
    ],
  },
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

  async function handleLogout() {
    await logoutMember();
    navigate("/login");
  }

  if (!storeMember) return null;
  const member = profile ?? storeMember;
  const isActive = member.status === "ACTIVE";
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
      sections={SECTIONS}
      userLabel={member.fullName}
      userSubtitle={
        isActive && batch ? (
          <VolunteerBatchBadge batch={batch} className="mt-0.5" />
        ) : (
          <p className="text-xs text-muted-foreground">{member.status}</p>
        )
      }
      userInitials={getInitials(member.fullName)}
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
