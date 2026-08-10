import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Award, CalendarDays, LayoutDashboard, LogOut, Share2, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { useMemberAuthStore } from "@/stores/member-auth";
import { logoutMember } from "@/lib/member-auth";
import { useMyReferralSummary } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/member", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/member/referrals", label: "My Referrals", icon: Share2, end: false },
  { to: "/member/events", label: "Events", icon: CalendarDays, end: false },
  { to: "/member/wallet", label: "Wallet", icon: Wallet, end: false },
  { to: "/member/rewards", label: "Rewards", icon: Award, end: false },
  { to: "/member/kyc", label: "KYC", icon: ShieldCheck, end: false },
];

function initials(name: string | undefined) {
  return (name ?? "—").slice(0, 2).toUpperCase();
}

export function MemberPortalLayout() {
  const navigate = useNavigate();
  const member = useMemberAuthStore((state) => state.member);
  // Fetched once here (not per-page) so the header's volunteer batch badge
  // and the wallet pill stay in sync everywhere in the portal, not just on Dashboard.
  const { data: summary } = useMyReferralSummary();
  const isActive = member?.status === "ACTIVE";

  async function handleLogout() {
    await logoutMember();
    navigate("/member/login");
  }

  return (
    <div className="min-h-screen bg-brand-bg-soft">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo variant="icon" size={30} className="sm:hidden" />
            <Logo variant="stacked" size={32} className="hidden sm:flex" />
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="bg-brand-green text-xs font-semibold text-white">
                {initials(member?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{member?.fullName}</p>
              {isActive && summary?.batch ? (
                <VolunteerBatchBadge batch={summary.batch} className="mt-0.5" />
              ) : (
                <p className="text-xs text-muted-foreground">{member?.status}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isActive && (
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
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-4xl gap-1 px-4 sm:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive: linkActive }) =>
                cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  linkActive
                    ? "border-brand-green text-brand-green"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white sm:hidden">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive: linkActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors",
                  linkActive ? "text-brand-green" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <Icon className="size-5" />
              {label === "My Referrals" ? "Referrals" : label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
