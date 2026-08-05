import { useState } from "react";
import { Menu, Bell, Search, ChevronDown, LogOut, User, Settings as SettingsIcon, Shield, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/Sidebar";
import { useAuthStore } from "@/stores/auth";
import { useActiveNotices } from "@/hooks/useNotices";
import { useOutstandingMembers } from "@/hooks/usePayments";
import { logout } from "@/lib/auth";

export function Topbar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const { data: notices = [] } = useActiveNotices();
  // Staff don't earn referral points, so the top-bar "wallet" reads as money
  // owed, not a balance — how many members still owe a joining/renewal fee,
  // scoped to this staff member's own jurisdiction same as the Payments page.
  const { data: outstandingMembers = [] } = useOutstandingMembers();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function handleGlobalSearch(e: React.FormEvent) {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/admin/members?search=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch("");
    }
  }

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <form onSubmit={handleGlobalSearch} className="relative hidden flex-1 max-w-md sm:block">
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
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
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
                <p className="text-xs text-muted-foreground">{notices.length} new notice{notices.length === 1 ? "" : "s"}</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notices.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No new notifications</p>
                ) : (
                  notices.slice(0, 5).map((notice) => (
                    <button
                      key={notice.id}
                      className="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent last:border-b-0"
                      onClick={() => setShowNotifications(false)}
                    >
                      <p className="text-sm font-medium truncate">{notice.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{notice.body}</p>
                      {notice.publishedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(notice.publishedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
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
                    onClick={() => { setShowNotifications(false); navigate("/admin/notices"); }}
                  >
                    View all notices
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand-green text-white text-xs">
                  {user ? (user.fullName ?? user.email).slice(0, 2).toUpperCase() : "—"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-tight">{user?.fullName ?? user?.email ?? "Account"}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.replace(/_/g, " ").toLowerCase()}</p>
              </div>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              <User className="size-4 mr-2" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
              <SettingsIcon className="size-4 mr-2" />
              Settings
            </DropdownMenuItem>
            {user?.role === "SUPER_ADMIN" && (
              <DropdownMenuItem onClick={() => navigate("/admin/audit-logs")}>
                <Shield className="size-4 mr-2" />
                Audit Logs
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="size-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
