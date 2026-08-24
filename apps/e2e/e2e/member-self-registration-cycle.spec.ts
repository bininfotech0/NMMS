import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import {
  E2E_BASELINE_PLAN_FEE,
  ensureActivePlan,
  memberLoginApi,
  memberRegisterApi,
  newApiContext,
  staffLoginApi,
} from "./support/api";
import { armThrottleRetry } from "./support/throttle-retry";
import { E2E_ADMIN, uniqueAadhaar, uniqueMobile, uniqueSuffix } from "./support/constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_FIXTURE = path.join(__dirname, "..", "fixtures", "photo.jpg");

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// A self-registered member starts DRAFT with no plan or payment at all
// (unlike a staff-created one) — MemberDashboard hands them into
// MemberCompleteRegistration's 3-step flow instead of a generic "pending"
// message. This spec drives that flow directly, since it's this session's
// own addition and applications-lifecycle.spec.ts only covers the
// staff-driven wizard path.

// Both positive-cycle tests below register interactively through the real
// /join UI form — see armThrottleRetry's own comment for why that needs its
// own retry path separate from support/api.ts's.
test.beforeEach(async ({ page }) => {
  await armThrottleRetry(page);
});

test.describe("self-service member registration cycle — positive", () => {
  test("register -> select plan -> fee collected -> upload docs -> submit for review", async ({ page }) => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    await ensureActivePlan(apiCtx, admin.accessToken);

    const fullName = `Self Cycle Member ${uniqueSuffix()}`;
    const mobile = uniqueMobile();
    const password = "SelfCycle123pw";

    // 1. Register -> DRAFT, no plan -> Step 1 of 3.
    await page.goto("/join");
    await page.getByLabel("Full name").fill(fullName);
    await page.getByLabel("Mobile number").fill(mobile);
    await page.getByLabel("Aadhaar number").fill(uniqueAadhaar(mobile));
    await page.getByLabel("Create a password").fill(password);
    await page.getByRole("button", { name: "Join now" }).click();
    await page.waitForURL("**/member");
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByText("Choose your membership plan")).toBeVisible();

    // 2. Select the seeded baseline plan -> planId set -> Step 2 of 3.
    await page.getByRole("button", { name: /E2E Baseline Plan/ }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.getByText("Pay your registration fee")).toBeVisible();
    await expect(page.getByText(`₹${E2E_BASELINE_PLAN_FEE}`)).toBeVisible();

    // 3. Staff collects the fee in person — same escape hatch a stuck
    // self-service member has in real use. (The online-checkout path is a
    // hosted Razorpay iframe outside this app's own DOM and isn't something
    // reliably driven from a browser e2e context; it's covered by manual/live
    // verification instead.) DRAFT -> PAYMENT_COLLECTED -> reload -> Step 3.
    const membersRes = await apiCtx.get("/api/v1/members", { headers: authHeaders(admin.accessToken) });
    const allMembers = (await membersRes.json()).data as Array<{ id: string; fullName: string }>;
    const memberId = allMembers.find((m) => m.fullName === fullName)!.id;
    await apiCtx.post(`/api/v1/members/${memberId}/payments`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: E2E_BASELINE_PLAN_FEE, mode: "CASH" },
    });
    await page.reload();
    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await expect(page.getByText("Finish your profile")).toBeVisible();

    // 4. Address, via the member's own profile-update endpoint — MyProfile's
    // full form is exercised elsewhere; this step only cares that the
    // checklist reacts to it being filled in.
    const { accessToken: memberToken } = await memberLoginApi(apiCtx, mobile, password);
    const addressPatchRes = await apiCtx.patch("/api/v1/members/me", {
      headers: authHeaders(memberToken),
      data: { addressLine: "42 Self Service Lane", pincode: "110001" },
    });
    expect(addressPatchRes.ok(), await addressPatchRes.text()).toBe(true);
    await page.reload();
    await expect(page.getByText("Address & personal details")).toBeVisible();
    // Styled as a button but rendered via <Button asChild><Link>, so its
    // accessible role is "link".
    await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();

    // 5. Photo + ID proof, through the real (hidden) file inputs.
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible();
    await fileInputs.nth(1).setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByRole("button", { name: "Add another" })).toBeVisible();

    // 6. Declarations + submit.
    for (const label of [
      "I declare the information provided is true and correct",
      "I accept the organization's constitution",
      "I accept the privacy policy",
      "I accept the terms & conditions",
    ]) {
      await page.getByText(label, { exact: true }).locator('input[type="checkbox"]').check();
    }
    await page.locator("#declarationPlace").fill("New Delhi");
    await page.getByRole("button", { name: "Submit for Review" }).click();

    // 7. SUBMITTED falls out of MemberCompleteRegistration entirely — back to
    // the generic pending-review message.
    await expect(page.getByText("Registration pending review")).toBeVisible();
  });
});

test.describe("self-service member registration cycle — negative", () => {
  test("registering an already-used mobile number shows an inline error instead of crashing", async ({ page }) => {
    const apiCtx = await newApiContext();
    const mobile = uniqueMobile();
    const password = "DupeCycle123pw";
    // First registration succeeds via API.
    const first = await memberRegisterApi(apiCtx, { fullName: "First Comer", mobile, password });
    expect(first).not.toBeNull();

    // A second registration attempt with the same mobile, via the real UI.
    await page.goto("/join");
    await page.getByLabel("Full name").fill("Second Comer");
    await page.getByLabel("Mobile number").fill(mobile);
    await page.getByLabel("Aadhaar number").fill(uniqueAadhaar(uniqueMobile()));
    await page.getByLabel("Create a password").fill("SecondComer123pw");
    await page.getByRole("button", { name: "Join now" }).click();
    await expect(page.getByText(/already registered/i)).toBeVisible();
    await expect(page).toHaveURL(/\/join$/);
  });

  // A single registered member walked through several plan-selection edge
  // cases in sequence — the public register endpoint is IP-throttled
  // (8/60s), so this spec deliberately keeps its total registration count
  // low rather than spinning up a fresh member per assertion.
  test("plan selection: rejects a non-existent plan id, then rejects re-selecting once one is set", async () => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const planId = await ensureActivePlan(apiCtx, admin.accessToken);
    const mobile = uniqueMobile();
    const registered = await memberRegisterApi(apiCtx, {
      fullName: "Plan Edge Cases Member",
      mobile,
      password: "PlanEdge123pw",
    });

    // A bad id 404s before ever touching planId, so the member is still
    // eligible for a real selection afterward.
    const badPlan = await apiCtx.post("/api/v1/members/me/plan", {
      headers: authHeaders(registered!.accessToken),
      data: { planId: "not-a-real-plan-id" },
    });
    expect(badPlan.status()).toBe(404);

    const first = await apiCtx.post("/api/v1/members/me/plan", {
      headers: authHeaders(registered!.accessToken),
      data: { planId },
    });
    expect(first.ok()).toBe(true);

    const second = await apiCtx.post("/api/v1/members/me/plan", {
      headers: authHeaders(registered!.accessToken),
      data: { planId },
    });
    expect(second.status()).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.message ?? JSON.stringify(secondBody)).toMatch(/already been selected/i);
  });

  // Same member walked through both submit-gate rejections in sequence —
  // fee-not-collected first, then documents-missing once the fee clears.
  test("submit gate: rejects before the fee is collected, then rejects missing documents once it is", async () => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const planId = await ensureActivePlan(apiCtx, admin.accessToken);
    const mobile = uniqueMobile();
    const registered = await memberRegisterApi(apiCtx, {
      fullName: "Submit Gate Member",
      mobile,
      password: "SubmitGate123pw",
    });
    await apiCtx.post("/api/v1/members/me/plan", {
      headers: authHeaders(registered!.accessToken),
      data: { planId },
    });

    const beforeFee = await apiCtx.post("/api/v1/members/me/submit", {
      headers: authHeaders(registered!.accessToken),
    });
    expect(beforeFee.status()).toBe(409);
    const beforeFeeBody = await beforeFee.json();
    expect(beforeFeeBody.message ?? JSON.stringify(beforeFeeBody)).toMatch(/fee must be collected first/i);

    const membersRes = await apiCtx.get("/api/v1/members", { headers: authHeaders(admin.accessToken) });
    const allMembers = (await membersRes.json()).data as Array<{ id: string; fullName: string }>;
    const memberId = allMembers.find((m) => m.fullName === "Submit Gate Member")!.id;
    await apiCtx.post(`/api/v1/members/${memberId}/payments`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: E2E_BASELINE_PLAN_FEE, mode: "CASH" },
    });
    // Every other REQUIRED_FOR_SUBMIT field, so the next submit call is
    // rejected specifically for missing documents rather than these.
    await apiCtx.patch("/api/v1/members/me", {
      headers: authHeaders(registered!.accessToken),
      data: {
        addressLine: "1 Submit Gate Street",
        pincode: "110001",
        declarationInfoCorrect: true,
        declarationAcceptConstitution: true,
        declarationAcceptPrivacyPolicy: true,
        declarationAcceptTerms: true,
      },
    });

    const afterFee = await apiCtx.post("/api/v1/members/me/submit", {
      headers: authHeaders(registered!.accessToken),
    });
    expect(afterFee.status()).toBe(409);
    const afterFeeBody = await afterFee.json();
    expect(afterFeeBody.message ?? JSON.stringify(afterFeeBody)).toMatch(/upload a passport photo/i);
  });
});
