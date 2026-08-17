import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { Award, CalendarDays, LayoutDashboard, Share2, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Shell } from "@/components/layout/shell/Shell";
import type { ShellNavSection } from "@/components/layout/shell/types";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { useMemberAuthStore } from "@/stores/member-auth";
import { logoutMember } from "@/lib/member-auth";
import { useMyReferralSummary } from "@/hooks/useReferrals";
import { getInitials, cn } from "@/lib/utils";

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
  const member = useMemberAuthStore((state) => state.member);
  // Fetched once here (not per-page) so the header's volunteer batch badge
  // and the wallet pill stay in sync everywhere in the portal, not just on Dashboard.
  const { data: summary } = useMyReferralSummary();
  const isActive = member?.status === "ACTIVE";

  async function handleLogout() {
    await logoutMember();
    navigate("/login");
  }

  if (!member) return null;

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
        isActive && summary?.batch ? (
          <VolunteerBatchBadge batch={summary.batch} className="mt-0.5" />
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
