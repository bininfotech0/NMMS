export const BASE_URL = "http://localhost";

// Shared by support/api.ts and support/throttle-retry.ts — both extend a
// colliding test's timeout to survive the server's ~60s IP-keyed throttle
// window (see either file's own comment for the full explanation). One
// constant so the two independently-hardcoded margins can't drift apart if
// the server's window ever changes.
export const THROTTLE_RETRY_TEST_TIMEOUT_MS = 90_000;

// Paths for `test.use({ storageState: AUTH_STATE.xxx })` — relative to
// apps/e2e (playwright.config.ts's rootDir), matching global-setup.ts's
// output paths.
export const AUTH_STATE = {
  superAdmin: ".auth/super-admin.json",
  admin: ".auth/admin.json",
  fieldExecutive: ".auth/field-executive.json",
  member: ".auth/member.json",
} as const;

export const SEED_SUPER_ADMIN = { email: "admin@example.com", password: "ChangeMe123!" };

export const E2E_ADMIN = { email: "e2e-admin@example.com", password: "E2eAdmin123pw" };
export const E2E_FIELD_EXECUTIVE = { email: "e2e-fe@example.com", password: "E2eFieldExec123pw" };

// Fixed, well-known credentials for the one shared ACTIVE member used by
// read-only member-portal specs (Wallet/Rewards/Dashboard smoke checks).
// Cycle-specific specs (referral/events/promotion) create their own fresh
// members instead of reusing this one, since those cycles mutate state.
export const SHARED_ACTIVE_MEMBER = {
  fullName: "E2E Shared Member",
  mobile: "9000000001",
  password: "E2eMember123pw",
};

export function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// India-shaped 10-digit mobile numbers the backend's validators accept,
// derived from a monotonically-increasing counter so parallel specs run in
// the same worker never collide within a single suite run.
let mobileCounter = 0;
export function uniqueMobile(): string {
  mobileCounter += 1;
  const suffix = `${Date.now()}`.slice(-6);
  return `70${suffix}${String(mobileCounter).padStart(2, "0")}`.slice(0, 10);
}

// memberRegisterSchema requires a 12-digit Aadhaar number — derive one
// deterministically from an already-unique mobile so callers don't need to
// track a second counter, matching support/api.ts's memberRegisterApi.
export function uniqueAadhaar(mobile: string): string {
  return `20${mobile.replace(/\D/g, "").slice(-10).padStart(10, "0")}`;
}
