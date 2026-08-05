import { create } from "zustand";
import type { AuthMember } from "@nmms/shared";

type MemberAuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface MemberAuthState {
  member: AuthMember | null;
  accessToken: string | null;
  status: MemberAuthStatus;
  setSession: (member: AuthMember, accessToken: string) => void;
  clearSession: () => void;
}

// Deliberately separate from useAuthStore (apps/web/src/stores/auth.ts) —
// a staff session and a member session can coexist in the same browser tab
// without either clobbering the other's token.
export const useMemberAuthStore = create<MemberAuthState>((set) => ({
  member: null,
  accessToken: null,
  status: "idle",
  setSession: (member, accessToken) => set({ member, accessToken, status: "authenticated" }),
  clearSession: () => set({ member: null, accessToken: null, status: "unauthenticated" }),
}));
