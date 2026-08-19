import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_URL } from "./constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, "..", "..", ".auth", "tokens.json");

interface Envelope<T> {
  success: boolean;
  data: T;
}

async function unwrap<T>(res: { ok(): boolean; status(): number; json(): Promise<unknown>; url(): string }): Promise<T> {
  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`API ${res.status()} on ${res.url()}: ${JSON.stringify(body)}`);
  }
  const body = (await res.json()) as Envelope<T>;
  return body.data;
}

/** A short-lived APIRequestContext for pure fixture setup (not itself a UI test). */
export async function newApiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BASE_URL });
}

// POST /auth/login is throttled server-side (8/60s, IP-keyed) — tight enough
// that letting every spec file's fixture setup log in again reliably
// exhausts it partway through a full run. global-setup.ts logs in once for
// each of the 3 known staff accounts and persists the tokens to
// .auth/tokens.json; this reads that file (once, then an in-memory cache for
// the rest of the worker process) instead of ever hitting the endpoint again
// for those accounts. Any other email falls back to a real login.
const staffTokenCache = new Map<string, { accessToken: string; userId: string; role: string }>();
let persistedTokens: Record<string, { accessToken: string; userId: string; role: string }> | null = null;

async function loadPersistedTokens() {
  if (persistedTokens) return persistedTokens;
  try {
    persistedTokens = JSON.parse(await readFile(TOKENS_FILE, "utf-8"));
  } catch {
    persistedTokens = {};
  }
  return persistedTokens;
}

export async function staffLoginApi(
  ctx: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string; userId: string; role: string }> {
  const cached = staffTokenCache.get(email);
  if (cached) return cached;

  const persisted = (await loadPersistedTokens())[email];
  if (persisted) {
    staffTokenCache.set(email, persisted);
    return persisted;
  }

  const res = await ctx.post("/api/v1/auth/login", { data: { email, password } });
  const data = await unwrap<{ accessToken: string; user: { id: string; role: string } }>(res);
  const result = { accessToken: data.accessToken, userId: data.user.id, role: data.user.role };
  staffTokenCache.set(email, result);
  return result;
}

export async function memberLoginApi(
  ctx: APIRequestContext,
  mobile: string,
  password: string,
): Promise<{ accessToken: string; memberId: string }> {
  const res = await ctx.post("/api/v1/public/member-auth/login", { data: { mobile, password } });
  const data = await unwrap<{ accessToken: string; member: { id: string } }>(res);
  return { accessToken: data.accessToken, memberId: data.member.id };
}

export async function memberRegisterApi(
  ctx: APIRequestContext,
  params: { fullName: string; mobile: string; password: string; referralCode?: string; aadhaarNumber?: string },
): Promise<{ accessToken: string; memberId: string } | null> {
  // aadhaarNumber is required by memberRegisterSchema (12 digits) but most
  // callers here don't have a real one to test with — derive a unique,
  // deterministic 12-digit value from the (already-unique-per-test) mobile
  // number rather than making every call site pass one explicitly.
  const aadhaarNumber = params.aadhaarNumber ?? `20${params.mobile.replace(/\D/g, "").slice(-10).padStart(10, "0")}`;
  const res = await ctx.post("/api/v1/public/member-auth/register", { data: { ...params, aadhaarNumber } });
  if (res.status() === 409) return null; // already registered — caller falls back to login
  const data = await unwrap<{ accessToken: string; member: { id: string } }>(res);
  return { accessToken: data.accessToken, memberId: data.member.id };
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Idempotent: returns the existing user's id (via a login) if the email is already taken. */
export async function ensureStaffUser(
  ctx: APIRequestContext,
  superAdminToken: string,
  params: { email: string; password: string; role: string },
): Promise<void> {
  const res = await ctx.post("/api/v1/users", {
    headers: authHeaders(superAdminToken),
    data: { email: params.email, password: params.password, role: params.role },
  });
  if (res.status() === 409 || res.ok()) return;
  throw new Error(`ensureStaffUser failed (${res.status()}): ${await res.text()}`);
}

// Fixed fee this suite's fixtures rely on when recording a matching payment
// (PaymentsService.assertManualAmountMatchesFee requires an exact match) —
// centralized here so every caller pays exactly what this plan actually
// costs instead of a number that happens to match today.
export const E2E_BASELINE_PLAN_FEE = 100;

export async function ensureActivePlan(
  ctx: APIRequestContext,
  staffToken: string,
): Promise<string> {
  // Matched by name, not just "any active plan" — the org can accumulate
  // other active plans (seeded data, other tests, manual exploration) whose
  // fee has nothing to do with E2E_BASELINE_PLAN_FEE, which would break every
  // fixture that pays that fixed amount against whatever plan comes back.
  const listRes = await ctx.get("/api/v1/plans", { headers: authHeaders(staffToken) });
  const plans = await unwrap<Array<{ id: string; name: string; isActive: boolean }>>(listRes);
  const existing = plans.find((p) => p.isActive && p.name === "E2E Baseline Plan");
  if (existing) return existing.id;

  const createRes = await ctx.post("/api/v1/plans", {
    headers: authHeaders(staffToken),
    data: { name: "E2E Baseline Plan", fee: E2E_BASELINE_PLAN_FEE, validityType: "LIFETIME" },
  });
  const created = await unwrap<{ id: string }>(createRes);
  return created.id;
}

// Same idea as ensureActivePlan but with a tier set — needed by any fixture
// that exercises volunteer-batch behavior (ReferralsService.awardBatchRewardForTier
// only fires for a tiered plan; the untiered E2E Baseline Plan above never
// grants a batch reward on activation).
export async function ensureTieredPlan(
  ctx: APIRequestContext,
  staffToken: string,
  tier: "SILVER" | "GOLD" | "PLATINUM",
): Promise<string> {
  const name = `E2E ${tier} Plan`;
  const listRes = await ctx.get("/api/v1/plans", { headers: authHeaders(staffToken) });
  const plans = await unwrap<Array<{ id: string; name: string; isActive: boolean }>>(listRes);
  const existing = plans.find((p) => p.isActive && p.name === name);
  if (existing) return existing.id;

  const createRes = await ctx.post("/api/v1/plans", {
    headers: authHeaders(staffToken),
    data: { name, tier, fee: E2E_BASELINE_PLAN_FEE, validityType: "LIFETIME" },
  });
  const created = await unwrap<{ id: string }>(createRes);
  return created.id;
}

/** Staff directly registers a member (non-self-registered), left in DRAFT. */
export async function createDraftMemberApi(
  ctx: APIRequestContext,
  staffToken: string,
  params: { fullName: string; mobile: string },
): Promise<string> {
  const res = await ctx.post("/api/v1/members", { headers: authHeaders(staffToken), data: params });
  const created = await unwrap<{ id: string }>(res);
  return created.id;
}

/**
 * Fills the minimum required fields, collects an offline payment, and submits
 * — takes a member from DRAFT (or PAYMENT_COLLECTED) through to SUBMITTED.
 * `actorToken` must belong to whoever currently owns/can-edit the member
 * (its creator, or an ADMIN/SUPER_ADMIN).
 */
const PHOTO_FIXTURE = path.join(__dirname, "..", "..", "fixtures", "photo.jpg");

// MembersService.submit() requires at least one PHOTO and one ID-proof
// document on file — upload the same fixture image under both slots rather
// than duplicating multipart-request boilerplate at every call site that
// needs a member past SUBMITTED.
async function uploadRequiredDocumentsApi(ctx: APIRequestContext, actorToken: string, memberId: string): Promise<void> {
  const buffer = await readFile(PHOTO_FIXTURE);
  for (const type of ["PHOTO", "AADHAAR_FRONT"]) {
    await ctx.post(`/api/v1/members/${memberId}/documents`, {
      headers: authHeaders(actorToken),
      multipart: { type, file: { name: "photo.jpg", mimeType: "image/jpeg", buffer } },
    });
  }
}

export async function bringMemberToSubmittedApi(
  ctx: APIRequestContext,
  actorToken: string,
  memberId: string,
  planId?: string,
): Promise<void> {
  planId ??= await ensureActivePlan(ctx, actorToken);
  await ctx.patch(`/api/v1/members/${memberId}`, {
    headers: authHeaders(actorToken),
    data: {
      planId,
      addressLine: "123 E2E Test Street",
      pincode: "110001",
      declarationInfoCorrect: true,
      declarationAcceptConstitution: true,
      declarationAcceptPrivacyPolicy: true,
      declarationAcceptTerms: true,
    },
  });
  await ctx.post(`/api/v1/members/${memberId}/payments`, {
    headers: authHeaders(actorToken),
    data: { amount: E2E_BASELINE_PLAN_FEE, mode: "CASH" },
  });
  await uploadRequiredDocumentsApi(ctx, actorToken, memberId);
  await ctx.post(`/api/v1/members/${memberId}/submit`, { headers: authHeaders(actorToken) });
}

/**
 * Fast-path fixture: self-registers a member, claims it, fills the minimum
 * required fields, collects an offline payment, submits, and approves it —
 * i.e. runs the exact member lifecycle that member-registration-wizard.spec.ts
 * and applications-lifecycle.spec.ts test via the UI, but over the API, for
 * specs that need an ACTIVE member as a precondition rather than as the thing
 * under test.
 */
export async function createActiveMemberApi(
  ctx: APIRequestContext,
  params: { fullName: string; mobile: string; password: string; referralCode?: string },
  claimerToken: string,
  approverToken: string,
  planId?: string,
): Promise<string> {
  const registered = await memberRegisterApi(ctx, params);
  const memberId = registered
    ? registered.memberId
    : (await memberLoginApi(ctx, params.mobile, params.password)).memberId;

  // Already active from a previous run? Nothing left to do.
  const existing = await unwrap<{ status: string }>(
    await ctx.get(`/api/v1/members/${memberId}`, { headers: authHeaders(approverToken) }),
  );
  if (existing.status === "ACTIVE") return memberId;

  await ctx.post(`/api/v1/members/${memberId}/claim`, { headers: authHeaders(claimerToken) });
  await bringMemberToSubmittedApi(ctx, approverToken, memberId, planId);
  await ctx.post(`/api/v1/applications/${memberId}/approve`, { headers: authHeaders(approverToken) });

  return memberId;
}
