import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="no-print">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <div className="no-print">
          <Topbar />
        </div>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      <div className="no-print lg:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
