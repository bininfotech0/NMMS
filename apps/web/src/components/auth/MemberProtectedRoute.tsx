import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMemberAuthStore } from "@/stores/member-auth";

export function MemberProtectedRoute({ children }: { children: ReactNode }) {
  const status = useMemberAuthStore((state) => state.status);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/member/login" replace />;
  }

  return children;
}
