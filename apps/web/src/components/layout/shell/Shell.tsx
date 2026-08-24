import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, MoreHorizontal, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ShellNavItem, ShellNavSection, ShellProps } from "./types";

function flattenSections(sections: ShellNavSection[]): ShellNavItem[] {
  return sections.flatMap((section) => section.items);
}

function SidebarNavLink({ item, onNavigate }: { item: ShellNavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )
      }
    >
      <item.icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {!!item.badgeCount && (
        <span className="ml-auto rounded-full bg-brand-gold px-2 py-0.5 text-xs font-semibold text-brand-brown">
          {item.badgeCount}
        </span>
      )}
    </NavLink>
  );
}

function TabNavLink({ item }: { item: ShellNavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "border-brand-green text-brand-green" : "border-transparent text-muted-foreground hover:text-foreground",
        )
      }
    >
      {item.label}
    </NavLink>
  );
}

function BottomNavLink({ item }: { item: ShellNavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors",
          isActive ? "text-brand-green" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      <div className="relative">
        <item.icon className="size-5" />
        {!!item.badgeCount && (
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-brand-gold text-[9px] font-bold text-brand-brown">
            {item.badgeCount > 9 ? "9+" : item.badgeCount}
          </span>
        )}
      </div>
      {item.shortLabel ?? item.label}
    </NavLink>
  );
}

// The bottom tab bar only has room for a handful of items before they get
// squeezed unreadable/off-screen on a phone — cap what renders directly and
// fold the rest behind a "More" tab that opens a full-list sheet, so every
// nav item stays reachable on mobile regardless of how many sections/pages
// exist (11 for the member portal as of this writing, and growing). Set to 6
// (not lower) so it never clips AppShell's own curated 6-item mobileItems
// list (5 real destinations + its own literal "More" shortcut to Settings —
// that array is hand-picked on purpose, not the full nav, since "sidebar"
// density already has a separate hamburger-menu sheet for reaching every
// admin page on mobile).
const MAX_BOTTOM_TABS = 6;

function BottomNav({ items }: { items: ShellNavItem[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const overflow = items.length > MAX_BOTTOM_TABS;
  const visible = overflow ? items.slice(0, MAX_BOTTOM_TABS) : items;
  const hidden = overflow ? items.slice(MAX_BOTTOM_TABS) : [];

  return (
    <div className="flex items-center justify-around">
      {visible.map((item) => (
        <BottomNavLink key={item.key} item={item} />
      ))}
      {overflow && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <MoreHorizontal className="size-5" />
              More
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="inset-0 h-full max-h-full overflow-y-auto border-t-0">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4 pb-4">
              {hidden.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive ? "bg-brand-bg-soft text-brand-green" : "text-foreground hover:bg-muted",
                    )
                  }
                >
                  <item.icon className="size-5 shrink-0" />
                  {item.label}
                  {!!item.badgeCount && (
                    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-brown">
                      {item.badgeCount > 9 ? "9+" : item.badgeCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function SidebarNavList({
  sections,
  brandSlot,
  userLabel,
  userSubtitle,
  onLogout,
  onNavigate,
}: {
  sections: ShellNavSection[];
  brandSlot: React.ReactNode;
  userLabel: string;
  userSubtitle?: React.ReactNode;
  onLogout: () => void | Promise<void>;
  onNavigate?: () => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  function toggleSection(label: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">{brandSlot}</div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {sections.map((section) => {
          if (section.items.length === 0) return null;
          const isCollapsed = collapsedSections.has(section.label);

          return (
            <div key={section.label} className="mb-2">
              <button
                onClick={() => toggleSection(section.label)}
                className="flex w-full items-center gap-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
              >
                <ChevronDown className={cn("size-3 transition-transform", isCollapsed && "-rotate-90")} />
                {section.label}
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <SidebarNavLink key={item.key} item={item} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="mb-2 px-3 py-2 text-xs text-sidebar-foreground/50">
          <p className="truncate font-medium text-sidebar-foreground/80">{userLabel}</p>
          {userSubtitle && <p className="capitalize">{userSubtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function Shell({
  density,
  brandSlot,
  sections,
  mobileItems,
  userLabel,
  userSubtitle,
  userInitials,
  userAvatarUrl,
  onLogout,
  headerExtras,
  accountMenuItems,
  children,
}: ShellProps) {
  const bottomItems = mobileItems ?? flattenSections(sections);

  if (density === "sidebar") {
    return (
      <div className="flex min-h-screen bg-muted/40">
        <div className="no-print">
          <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
            <div className="fixed h-screen w-64">
              <SidebarNavList
                sections={sections}
                brandSlot={brandSlot}
                userLabel={userLabel}
                userSubtitle={userSubtitle}
                onLogout={onLogout}
              />
            </div>
          </aside>
        </div>

        <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
          <div className="no-print">
            <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SidebarNavList
                    sections={sections}
                    brandSlot={brandSlot}
                    userLabel={userLabel}
                    userSubtitle={userSubtitle}
                    onLogout={onLogout}
                  />
                </SheetContent>
              </Sheet>

              <div className="flex flex-1 items-center gap-3">{headerExtras}</div>

              {accountMenuItems && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent">
                      <Avatar className="size-8">
                        {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt="" />}
                        <AvatarFallback className="bg-brand-green text-xs text-white">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="hidden text-left sm:block">
                        <p className="text-sm font-medium leading-tight">{userLabel}</p>
                        {userSubtitle && (
                          <p className="text-[10px] capitalize text-muted-foreground">{userSubtitle}</p>
                        )}
                      </div>
                      <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {accountMenuItems.map((item) => (
                      <DropdownMenuItem key={item.label} onClick={item.onClick}>
                        <item.icon className="mr-2 size-4" />
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout}>
                      <LogOut className="mr-2 size-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </header>
          </div>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>

        <nav className="no-print fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
          <BottomNav items={bottomItems} />
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg-soft">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {brandSlot}
            <Avatar className="size-9 shrink-0">
              {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt="" />}
              <AvatarFallback className="bg-brand-green text-xs font-semibold text-white">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{userLabel}</p>
              {userSubtitle}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {headerExtras}
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-4xl gap-1 overflow-x-auto px-4 sm:flex">
          {flattenSections(sections).map((item) => (
            <TabNavLink key={item.key} item={item} />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:pb-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white sm:hidden">
        <BottomNav items={bottomItems} />
      </nav>
    </div>
  );
}
