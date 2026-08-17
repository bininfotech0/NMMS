import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  IdCard,
  Wallet,
  BarChart3,
  CalendarDays,
  FileText,
  Megaphone,
  Settings as SettingsIcon,
  UserCog,
  ShieldCheck,
  Search,
  Bell,
  Gift,
  Banknote,
  UserCheck,
  User,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { Shell } from "@/components/layout/shell/Shell";
import type { ShellAccountMenuItem, ShellNavItem, ShellNavSection } from "@/components/layout/shell/types";
import { useAuthStore } from "@/stores/auth";
import { useApplicationsQueue } from "@/hooks/useApplications";
import { useActiveNotices } from "@/hooks/useNotices";
import { useOutstandingMembers } from "@/hooks/usePayments";
import { logout } from "@/lib/auth";
import { getInitials } from "@/lib/utils";
import { Role } from "@nmms/shared";

const REVIEWER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];

type RawNavItem = ShellNavItem & { roles?: Role[] };

function buildSections(applicationsBadge: number | undefined, userRole: Role): ShellNavSection[] {
  const raw: { label: string; items: RawNavItem[] }[] = [
    { label: "Overview", items: [{ key: "dashboard", label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true }] },
    {
      label: "Membership",
      items: [
        { key: "members", label: "Members", to: "/admin/members", icon: Users },
        { key: "applications", label: "Applications", to: "/admin/applications", icon: ClipboardCheck, badgeCount: applicationsBadge },
        { key: "membership", label: "Membership Plans", to: "/admin/membership", icon: IdCard },
        { key: "referral-rewards", label: "Referral Rewards", to: "/admin/referral-rewards", icon: Gift },
        { key: "kyc", label: "KYC Review", to: "/admin/kyc", icon: UserCheck },
      ],
    },
    {
      label: "Finance",
      items: [
        { key: "payments", label: "Payments", to: "/admin/payments", icon: Wallet },
        { key: "withdrawals", label: "Withdrawals", to: "/admin/withdrawals", icon: Banknote },
      ],
    },
    {
      label: "Operations",
      items: [
        { key: "events", label: "Events", to: "/admin/events", icon: CalendarDays },
        { key: "documents", label: "Documents", to: "/admin/documents", icon: FileText },
        { key: "notices", label: "Notices", to: "/admin/notices", icon: Megaphone },
      ],
    },
    { label: "Reports", items: [{ key: "reports", label: "Reports & Analytics", to: "/admin/reports", icon: BarChart3 }] },
    {
      label: "Administration",
      items: [
        { key: "settings", label: "Settings", to: "/admin/settings", icon: SettingsIcon },
        { key: "users", label: "Users", to: "/admin/users", icon: UserCog, roles: [Role.ADMIN, Role.SUPER_ADMIN] },
        { key: "audit-logs", label: "Audit Logs", to: "/admin/audit-logs", icon: ShieldCheck, roles: [Role.ADMIN, Role.SUPER_ADMIN] },
      ],
    },
  ];

  return raw.map((section) => ({
    label: section.label,
    items: section.items
      .filter((item) => !item.roles || item.roles.includes(userRole))
      .map(({ roles: _roles, ...item }) => item),
  }));
}

function buildMobileItems(applicationsBadge: number | undefined): ShellNavItem[] {
  return [
    { key: "home", label: "Home", to: "/admin", icon: LayoutDashboard, end: true },
    { key: "members", label: "Members", to: "/admin/members", icon: Users },
    { key: "applications", label: "Applications", to: "/admin/applications", icon: ClipboardCheck, badgeCount: applicationsBadge },
    { key: "payments", label: "Payments", to: "/admin/payments", icon: Wallet },
    { key: "events", label: "Events", to: "/admin/events", icon: CalendarDays },
    { key: "more", label: "More", to: "/admin/settings", icon: UserCog },
  ];
}

function HeaderExtras() {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const { data: notices = [] } = useActiveNotices();
  // Staff don't earn referral points, so the top-bar "wallet" reads as money
  // owed, not a balance — how many members still owe a joining/renewal fee,
  // scoped to this staff member's own jurisdiction same as the Payments page.
  const { data: outstandingMembers = [] } = useOutstandingMembers();

  function handleGlobalSearch(e: React.FormEvent) {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/admin/members?search=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch("");
    }
  }

  return (
    <>
      <form onSubmit={handleGlobalSearch} className="relative hidden max-w-md flex-1 sm:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search members, ID, or mobile..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </form>

      <div className="flex flex-1 items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title={
            outstandingMembers.length > 0
              ? `${outstandingMembers.length} member${outstandingMembers.length === 1 ? "" : "s"} with outstanding payment`
              : "No outstanding payments"
          }
          onClick={() => navigate("/admin/payments")}
        >
          <Wallet className="size-5" />
          {outstandingMembers.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-green text-[10px] font-bold text-white">
              {outstandingMembers.length > 9 ? "9+" : outstandingMembers.length}
            </span>
          )}
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" className="relative" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell className="size-5" />
            {notices.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-brown">
                {notices.length > 9 ? "9+" : notices.length}
              </span>
            )}
          </Button>
          {showNotifications && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {notices.length} new notice{notices.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notices.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No new notifications</p>
                ) : (
                  notices.slice(0, 5).map((notice) => (
                    <button
                      key={notice.id}
                      className="w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent"
                      onClick={() => setShowNotifications(false)}
                    >
                      <p className="truncate text-sm font-medium">{notice.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{notice.body}</p>
                      {notice.publishedAt && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(notice.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
              {notices.length > 0 && (
                <div className="border-t border-border px-4 py-2">
                  <button
                    className="text-xs font-medium text-brand-green hover:text-brand-green-dark"
                    onClick={() => {
                      setShowNotifications(false);
                      navigate("/admin/notices");
                    }}
                  >
                    View all notices
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isReviewer = !!user && REVIEWER_ROLES.includes(user.role);
  const { data: pendingQueue = [] } = useApplicationsQueue(isReviewer);
  const applicationsBadge = isReviewer && pendingQueue.length > 0 ? pendingQueue.length : undefined;

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  if (!user) return null;

  const accountMenuItems: ShellAccountMenuItem[] = [
    { label: "Dashboard", icon: User, onClick: () => navigate("/admin") },
    { label: "Settings", icon: SettingsIcon, onClick: () => navigate("/admin/settings") },
    ...(user.role === Role.SUPER_ADMIN
      ? [{ label: "Audit Logs", icon: Shield, onClick: () => navigate("/admin/audit-logs") }]
      : []),
  ];

  return (
    <Shell
      density="sidebar"
      brandSlot={
        <>
          <Logo variant="icon" size={32} />
          <div className="leading-tight">
            <div className="font-heading text-sm font-bold tracking-wide">VEDVRIKSHA</div>
            <div className="text-[11px] text-sidebar-foreground/70">वेदवृक्ष</div>
          </div>
        </>
      }
      sections={buildSections(applicationsBadge, user.role)}
      mobileItems={buildMobileItems(applicationsBadge)}
      userLabel={user.fullName ?? user.email}
      userSubtitle={user.role.replace(/_/g, " ").toLowerCase()}
      userInitials={getInitials(user.fullName ?? user.email)}
      onLogout={handleLogout}
      headerExtras={<HeaderExtras />}
      accountMenuItems={accountMenuItems}
    >
      {children}
    </Shell>
  );
}
