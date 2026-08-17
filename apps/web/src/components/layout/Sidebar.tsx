import { NavLink, useNavigate } from "react-router-dom";
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
  Settings,
  UserCog,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Gift,
  Banknote,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth";
import { useApplicationsQueue } from "@/hooks/useApplications";
import { Role } from "@nmms/shared";

const REVIEWER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: (qty: number) => boolean;
  roles?: Role[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Membership",
    items: [
      { label: "Members", to: "/admin/members", icon: Users },
      { label: "Applications", to: "/admin/applications", icon: ClipboardCheck, badge: (q) => q > 0 },
      { label: "Membership Plans", to: "/admin/membership", icon: IdCard },
      { label: "Referral Rewards", to: "/admin/referral-rewards", icon: Gift },
      { label: "KYC Review", to: "/admin/kyc", icon: UserCheck },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments", to: "/admin/payments", icon: Wallet },
      { label: "Withdrawals", to: "/admin/withdrawals", icon: Banknote },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Events", to: "/admin/events", icon: CalendarDays },
      { label: "Documents", to: "/admin/documents", icon: FileText },
      { label: "Notices", to: "/admin/notices", icon: Megaphone },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports & Analytics", to: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Settings", to: "/admin/settings", icon: Settings },
      { label: "Users", to: "/admin/users", icon: UserCog, roles: [Role.ADMIN, Role.SUPER_ADMIN] },
      { label: "Audit Logs", to: "/admin/audit-logs", icon: ShieldCheck, roles: [Role.ADMIN, Role.SUPER_ADMIN] },
    ],
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isReviewer = !!user && REVIEWER_ROLES.includes(user.role);
  const { data: pendingQueue = [] } = useApplicationsQueue(isReviewer);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  async function handleLogout() {
    await logout();
    onNavigate?.();
    navigate("/login");
  }

  function toggleSection(label: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function filterItems(items: NavItem[]): NavItem[] {
    if (!user) return items;
    return items.filter((item) => !item.roles || item.roles.includes(user.role));
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo variant="icon" size={32} />
        <div className="leading-tight">
          <div className="font-heading text-sm font-bold tracking-wide">VEDVRIKSHA</div>
          <div className="text-[11px] text-sidebar-foreground/70">वेदवृक्ष</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => {
          const items = filterItems(section.items);
          if (items.length === 0) return null;
          const isCollapsed = collapsedSections.has(section.label);

          return (
            <div key={section.label} className="mb-2">
              <button
                onClick={() => toggleSection(section.label)}
                className="flex w-full items-center gap-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
              >
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    isCollapsed && "-rotate-90",
                  )}
                />
                {section.label}
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {items.map(({ label, to, icon: Icon, end, badge }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                      {to === "/admin/applications" && badge && isReviewer && pendingQueue.length > 0 && (
                        <span className="ml-auto rounded-full bg-brand-gold px-2 py-0.5 text-xs font-semibold text-brand-brown">
                          {pendingQueue.length}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        {user && (
          <div className="mb-2 px-3 py-2 text-xs text-sidebar-foreground/50">
            <p className="font-medium text-sidebar-foreground/80 truncate">{user.fullName ?? user.email}</p>
            <p className="capitalize">{user.role.replace(/_/g, " ").toLowerCase()}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
      <div className="fixed h-screen w-64">
        <SidebarContent />
      </div>
    </aside>
  );
}
