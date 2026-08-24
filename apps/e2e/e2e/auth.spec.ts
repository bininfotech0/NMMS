import { test, expect } from "@playwright/test";
import { memberLoginApi, newApiContext } from "./support/api";
import { armThrottleRetry } from "./support/throttle-retry";
import { SEED_SUPER_ADMIN, uniqueAadhaar, uniqueMobile } from "./support/constants";

// The default project has no storageState, so every test here starts from a
// clean, unauthenticated browser context.

// Nearly every test in this file logs in or registers interactively through
// the real UI form — see armThrottleRetry's own comment for why that needs
// its own retry path separate from support/api.ts's.
test.beforeEach(async ({ page }) => {
  await armThrottleRetry(page);
});

test.describe("staff login", () => {
  test("valid credentials land on the dashboard", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SEED_SUPER_ADMIN.email);
    await page.getByLabel("Password").fill(SEED_SUPER_ADMIN.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/admin");
    await expect(page.getByRole("heading", { name: /dashboard/i }).first()).toBeVisible();
  });

  test("invalid password shows an inline error and stays on /admin/login", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SEED_SUPER_ADMIN.email);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/invalid|incorrect|unauthorized/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("empty fields are blocked by required-field validation", async ({ page }) => {
    await page.goto("/admin/login");
    // The email field ships pre-filled with a placeholder admin address —
    // clear it explicitly so both required fields are genuinely empty.
    await page.getByLabel("Email").fill("");
    const passwordInput = page.getByLabel("Password");
    await page.getByRole("button", { name: "Sign In" }).click();
    // Native HTML5 validation keeps us on the page; the browser never fires
    // the submit handler, so the URL never leaves /admin/login.
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(passwordInput).toHaveJSProperty("validity.valid", false);
  });
});

test.describe("member login", () => {
  test("invalid credentials show an inline error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Mobile number").fill("9999999999");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/invalid|incorrect|unauthorized/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("valid credentials land on the member dashboard", async ({ page }) => {
    const mobile = uniqueMobile();
    const password = "AuthSpecMember123pw";
    await page.goto("/join");
    await page.getByLabel("Full name").fill("Auth Spec Login Member");
    await page.getByLabel("Mobile number").fill(mobile);
    await page.getByLabel("Aadhaar number").fill(uniqueAadhaar(mobile));
    await page.getByLabel("Create a password").fill(password);
    await page.getByRole("button", { name: "Join now" }).click();
    await page.waitForURL("**/member");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/login");

    await page.getByLabel("Mobile number").fill(mobile);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/member");
    // A self-registered member starts DRAFT with no plan at all, so the
    // dashboard hands them straight into the self-service registration flow
    // (see MemberCompleteRegistration) instead of a generic "pending" message.
    await expect(page.getByText("Choose your membership plan")).toBeVisible();
  });
});

test.describe("self-registration", () => {
  test("plain /join (no referral code) creates an account and lands on plan selection", async ({ page }) => {
    const mobile = uniqueMobile();
    await page.goto("/join");
    await expect(page.getByText("Referral link")).toHaveCount(0);
    await page.getByLabel("Full name").fill("Plain Self Registration");
    await page.getByLabel("Mobile number").fill(mobile);
    await page.getByLabel("Aadhaar number").fill(uniqueAadhaar(mobile));
    await page.getByLabel("Create a password").fill("PlainJoin123pw");
    await page.getByRole("button", { name: "Join now" }).click();
    await page.waitForURL("**/member");
    // A self-registered member starts DRAFT with no plan — the dashboard
    // guides them through the 3-step self-service flow (plan -> pay ->
    // finish profile) instead of a generic "pending review" message.
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByText("Choose your membership plan")).toBeVisible();
  });

  test("/join?ref=<code> shows the referrer's name and registers successfully", async ({ page }) => {
    // The shared ACTIVE member (created in global-setup) has a referral code
    // once it's ever fetched its own summary — fetch it once via API so this
    // test doesn't depend on UI-side code generation timing.
    const memberCtx = await newApiContext();
    const { accessToken: memberToken } = await memberLoginApi(memberCtx, "9000000001", "E2eMember123pw");
    const summaryRes = await memberCtx.get("/api/v1/referrals/me", {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const summary = (await summaryRes.json()).data as { referralCode: string; fullName?: string };
    await memberCtx.dispose();

    const mobile = uniqueMobile();
    await page.goto(`/join?ref=${summary.referralCode}`);
    await expect(page.getByText(/joining via/i)).toBeVisible();
    await page.getByLabel("Full name").fill("Referred Join Member");
    await page.getByLabel("Mobile number").fill(mobile);
    await page.getByLabel("Aadhaar number").fill(uniqueAadhaar(mobile));
    await page.getByLabel("Create a password").fill("ReferredJoin123pw");
    await page.getByRole("button", { name: "Join now" }).click();
    await page.waitForURL("**/member");
    await expect(page.getByText("Choose your membership plan")).toBeVisible();
  });
});

test.describe("logout", () => {
  test("staff sidebar logout returns to /admin/login", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SEED_SUPER_ADMIN.email);
    await page.getByLabel("Password").fill(SEED_SUPER_ADMIN.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/admin");
    await page.getByRole("button", { name: "Logout" }).click();
    await page.waitForURL("**/admin/login");
  });
});

test.describe("route guards", () => {
  test("unauthenticated /admin redirects to /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/admin/login");
  });

  test("unauthenticated /member redirects to /login", async ({ page }) => {
    await page.goto("/member");
    await page.waitForURL("**/login");
  });
});

test.describe("fallback pages", () => {
  test("/403 renders Access Denied with a working Go to Dashboard link", async ({ page }) => {
    await page.goto("/403");
    await expect(page.getByText("Access Denied")).toBeVisible();
    await page.getByRole("link", { name: "Go to Dashboard" }).click();
    await page.waitForURL("**/login"); // unauthenticated, so /admin bounces to /login
  });

  test("/404 renders for an unmatched route", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Dashboard" })).toBeVisible();
  });
});
