import type { AuthUser } from "@nmms/shared";
import { apiFetch } from "./api-client";
import { useAuthStore } from "@/stores/auth";

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  useAuthStore.getState().setSession(data.user, data.accessToken);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    useAuthStore.getState().clearSession();
  }
}

// Restores the session from the httpOnly refresh cookie on app boot (the access
// token itself only ever lives in memory, so it doesn't survive a page reload).
export async function initializeAuth(): Promise<void> {
  useAuthStore.setState({ status: "loading" });
  const res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
  if (!res.ok) {
    useAuthStore.getState().clearSession();
    return;
  }
  const data = (await res.json()) as { data: LoginResponse };
  useAuthStore.getState().setSession(data.data.user, data.data.accessToken);
}
