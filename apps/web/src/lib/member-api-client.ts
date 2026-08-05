import { useMemberAuthStore } from "@/stores/member-auth";
import type { AuthMember } from "@nmms/shared";
import { ApiError } from "./api-client";

interface MemberRefreshResponse {
  accessToken: string;
  member: AuthMember;
}

const API_PREFIX = "/api/v1";

async function refreshMemberSession(): Promise<boolean> {
  const res = await fetch(`${API_PREFIX}/member-auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) return false;
  const data = (await res.json()) as { data: MemberRefreshResponse };
  useMemberAuthStore.getState().setSession(data.data.member, data.data.accessToken);
  return true;
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

const NO_RETRY_PATHS = new Set(["/public/member-auth/login", "/member-auth/refresh"]);

// Small parallel of apiFetch (apps/web/src/lib/api-client.ts) that reads the
// member token instead of the staff token — kept separate so the
// well-exercised staff client isn't touched by this feature.
export async function memberApiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const { accessToken } = useMemberAuthStore.getState();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_PREFIX}${path}`, { ...options, headers, credentials: "include" });

  if (res.status === 401 && !isRetry && !NO_RETRY_PATHS.has(path)) {
    const refreshed = await refreshMemberSession();
    if (refreshed) {
      return memberApiFetch<T>(path, options, true);
    }
    useMemberAuthStore.getState().clearSession();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    return json.data as T;
  }
  return json as T;
}
