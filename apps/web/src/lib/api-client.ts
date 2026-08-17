import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import type { AuthUser } from "@nmms/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
}

const API_PREFIX = "/api/v1";

async function refreshSession(): Promise<boolean> {
  const res = await fetch(`${API_PREFIX}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) return false;
  const data = (await res.json()) as RefreshResponse;
  useAuthStore.getState().setSession(data.user, data.accessToken);
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

const NO_RETRY_PATHS = new Set(["/auth/login", "/auth/refresh"]);

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_PREFIX}${path}`, { ...options, headers, credentials: "include" });

  if (res.status === 401 && !isRetry && !NO_RETRY_PATHS.has(path)) {
    // Only warn when a real session just expired — not when apiFetch happens
    // to be called with no token at all (e.g. before login).
    const hadSession = !!useAuthStore.getState().accessToken;
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
    if (hadSession) {
      toast.error("Your session has expired — please log in again.");
    }
    useAuthStore.getState().clearSession();
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
