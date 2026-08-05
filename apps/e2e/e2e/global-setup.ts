import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, rm, writeFile } from "node:fs/promises";
import {
  createActiveMemberApi,
  ensureStaffUser,
  memberLoginApi,
  newApiContext,
  staffLoginApi,
} from "./support/api";
import { E2E_ADMIN, E2E_FIELD_EXECUTIVE, SEED_SUPER_ADMIN, SHARED_ACTIVE_MEMBER } from "./support/constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "..", ".auth");

// Pure API-driven fixture setup (Playwright's recommended pattern for auth
// state — see playwright.dev/docs/auth). The UI login flow itself is still
// fully exercised for real in auth.spec.ts; this just needs the resulting
// sessions fast and reliably so the other ~20 spec files can start from a
// known-good, already-authenticated state instead of re-logging-in every file.
export default async function globalSetup(): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
  // A stale tokens.json from a previous run would make staffLoginApi's
  // persisted-token cache short-circuit the real logins below — and it's
  // exactly those real logins whose Set-Cookie response is what populates
  // the storageState files written further down. Must not exist yet when
  // the calls in this function run.
  await rm(path.join(AUTH_DIR, "tokens.json"), { force: true });

  const superAdminCtx = await newApiContext();
  const superAdmin = await staffLoginApi(superAdminCtx, SEED_SUPER_ADMIN.email, SEED_SUPER_ADMIN.password);
  await superAdminCtx.storageState({ path: path.join(AUTH_DIR, "super-admin.json") });

  await ensureStaffUser(superAdminCtx, superAdmin.accessToken, { ...E2E_ADMIN, role: "ADMIN" });
  await ensureStaffUser(superAdminCtx, superAdmin.accessToken, {
    ...E2E_FIELD_EXECUTIVE,
    role: "FIELD_EXECUTIVE",
  });
  await superAdminCtx.dispose();

  const adminCtx = await newApiContext();
  const admin = await staffLoginApi(adminCtx, E2E_ADMIN.email, E2E_ADMIN.password);
  await adminCtx.storageState({ path: path.join(AUTH_DIR, "admin.json") });

  const feCtx = await newApiContext();
  const fe = await staffLoginApi(feCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
  await feCtx.storageState({ path: path.join(AUTH_DIR, "field-executive.json") });

  // Shared ACTIVE member for member-portal-readonly.spec.ts. Claimed by the FE
  // and approved by the admin so both roles' jurisdiction rules are satisfied.
  await createActiveMemberApi(adminCtx, SHARED_ACTIVE_MEMBER, fe.accessToken, admin.accessToken);
  const memberCtx = await newApiContext();
  await memberLoginApi(memberCtx, SHARED_ACTIVE_MEMBER.mobile, SHARED_ACTIVE_MEMBER.password);
  await memberCtx.storageState({ path: path.join(AUTH_DIR, "member.json") });

  await adminCtx.dispose();
  await feCtx.dispose();
  await memberCtx.dispose();

  // POST /auth/login is throttled server-side (8/60s, IP-keyed) — that budget
  // is tight enough that letting every spec file's fixture setup log in again
  // (even to a cache that doesn't survive the process boundary between this
  // script and the test workers) reliably exhausts it partway through a full
  // run. Persist the tokens obtained above so support/api.ts's staffLoginApi
  // can read them instead of ever calling the endpoint again for these 3
  // accounts — the only real logins for the rest of the run are the ones
  // auth.spec.ts deliberately exercises through the UI.
  await writeFile(
    path.join(AUTH_DIR, "tokens.json"),
    JSON.stringify({
      [SEED_SUPER_ADMIN.email]: superAdmin,
      [E2E_ADMIN.email]: admin,
      [E2E_FIELD_EXECUTIVE.email]: fe,
    }),
  );
}
