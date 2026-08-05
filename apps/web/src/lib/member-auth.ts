import type { AuthMember, MemberLoginInput, MemberRegisterInput } from "@nmms/shared";
import { memberApiFetch } from "./member-api-client";
import { useMemberAuthStore } from "@/stores/member-auth";

interface MemberLoginResponse {
  accessToken: string;
  member: AuthMember;
}

export async function registerMember(dto: MemberRegisterInput): Promise<AuthMember> {
  const data = await memberApiFetch<MemberLoginResponse>("/public/member-auth/register", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  useMemberAuthStore.getState().setSession(data.member, data.accessToken);
  return data.member;
}

export async function loginMember(dto: MemberLoginInput): Promise<AuthMember> {
  const data = await memberApiFetch<MemberLoginResponse>("/public/member-auth/login", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  useMemberAuthStore.getState().setSession(data.member, data.accessToken);
  return data.member;
}

export async function logoutMember(): Promise<void> {
  try {
    await memberApiFetch("/member-auth/logout", { method: "POST" });
  } finally {
    useMemberAuthStore.getState().clearSession();
  }
}

// Restores the session from the httpOnly member_refresh_token cookie on app
// boot — same pattern as initializeAuth (apps/web/src/lib/auth.ts).
export async function initializeMemberAuth(): Promise<void> {
  useMemberAuthStore.setState({ status: "loading" });
  const res = await fetch("/api/v1/member-auth/refresh", { method: "POST", credentials: "include" });
  if (!res.ok) {
    useMemberAuthStore.getState().clearSession();
    return;
  }
  const data = (await res.json()) as { data: MemberLoginResponse };
  useMemberAuthStore.getState().setSession(data.data.member, data.data.accessToken);
}
