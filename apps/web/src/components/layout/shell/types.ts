import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ShellDensity = "sidebar" | "tabs";

export interface ShellNavItem {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  badgeCount?: number;
  /** Bottom-tab-bar label override, e.g. "My Referrals" -> "Referrals". */
  shortLabel?: string;
}

export interface ShellNavSection {
  /** Ignored when density="tabs" — sections are a sidebar-only concept. */
  label: string;
  items: ShellNavItem[];
}

export interface ShellAccountMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

export interface ShellProps {
  density: ShellDensity;
  /** Pre-rendered logo + wordmark, supplied verbatim by each adapter. */
  brandSlot: ReactNode;
  /** Already role-filtered / access-resolved — Shell does no auth checks. */
  sections: ShellNavSection[];
  /** Curated bottom-tab-bar override; falls back to the flattened sections. */
  mobileItems?: ShellNavItem[];
  userLabel: string;
  /**
   * density="sidebar": plain text (e.g. humanized role) — Shell wraps it in
   * context-specific <p> markup at each of its two render sites.
   * density="tabs": fully-formed markup (e.g. a badge or a <p>) rendered as-is.
   */
  userSubtitle?: ReactNode;
  userInitials: string;
  onLogout: () => void | Promise<void>;
  /** density="sidebar": search + wallet + bell cluster. density="tabs": wallet-points pill. */
  headerExtras?: ReactNode;
  /** density="sidebar" only — tabs density always renders a plain sign-out button. */
  accountMenuItems?: ShellAccountMenuItem[];
  children: ReactNode;
}
