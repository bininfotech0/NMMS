import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Wallet,
  CalendarDays,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApplicationsQueue } from "@/hooks/useApplications";
import { useAuthStore } from "@/stores/auth";
import { Role } from "@nmms/shared";

const REVIEWER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];

const NAV_ITEMS = [
  { label: "Home", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Members", to: "/admin/members", icon: Users },
  { label: "Applications", to: "/admin/applications", icon: ClipboardCheck },
  { label: "Payments", to: "/admin/payments", icon: Wallet },
  { label: "Events", to: "/admin/events", icon: CalendarDays },
  { label: "More", to: "/admin/settings", icon: UserCog },
];

export function MobileNav() {
  const user = useAuthStore((state) => state.user);
  const isReviewer = !!user && REVIEWER_ROLES.includes(user.role);
  const { data: pendingQueue = [] } = useApplicationsQueue(isReviewer);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-brand-green"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <div className="relative">
              <Icon className="size-5" />
              {to === "/admin/applications" && isReviewer && pendingQueue.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-brand-gold text-[9px] font-bold text-brand-brown">
                  {pendingQueue.length > 9 ? "9+" : pendingQueue.length}
                </span>
              )}
            </div>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
