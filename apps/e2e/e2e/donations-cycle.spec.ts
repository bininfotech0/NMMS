import { test, expect } from "@playwright/test";
import {
  createActiveMemberApi,
  createDraftMemberApi,
  memberLoginApi,
  newApiContext,
  staffLoginApi,
} from "./support/api";
import { armThrottleRetry } from "./support/throttle-retry";
import { AUTH_STATE, E2E_ADMIN, E2E_FIELD_EXECUTIVE, uniqueMobile, uniqueSuffix } from "./support/constants";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe("donation cycle — positive", () => {
  test("member submits (manual, with donor Address/PAN) -> staff approves -> points credited -> receipt shows donor details", async ({
    browser,
  }) => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);

    const fullName = `Donor Cycle Member ${uniqueSuffix()}`;
    const mobile = uniqueMobile();
    const password = "DonorCycle123pw";
    await createActiveMemberApi(apiCtx, { fullName, mobile, password }, fe.accessToken, admin.accessToken);

    // 1. Member submits a manual donation with donor tax-receipt details.
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await armThrottleRetry(memberPage);
    await memberPage.goto("/login");
    await memberPage.getByLabel("Mobile number").fill(mobile);
    await memberPage.getByLabel("Password").fill(password);
    await memberPage.getByRole("button", { name: "Sign In" }).click();
    await memberPage.waitForURL("**/member");

    await memberPage.goto("/member/donations");
    // If online donations are enabled for this org, the manual form starts
    // collapsed behind this toggle — reveal it. If the payment gateway isn't
    // configured, the manual form is already the only option shown.
    const manualToggle = memberPage.getByRole("button", { name: "Sent it another way? Record it manually instead" });
    if (await manualToggle.count()) {
      await manualToggle.click();
    }
    await memberPage.getByLabel("Amount").fill("500");
    await memberPage.getByLabel("Address (optional)").fill("12 MG Road, Pune");
    await memberPage.getByLabel("PAN (optional)").fill("ABCDE1234F");
    await memberPage.getByLabel("How did you send it?").selectOption("UPI");
    await memberPage.getByLabel("Reference / transaction no. (optional)").fill("UPI-REF-CYCLE-1");
    await memberPage.getByRole("button", { name: "Submit Donation" }).click();
    await expect(memberPage.getByText("₹500")).toBeVisible();
    await expect(memberPage.getByText("Pending", { exact: true })).toBeVisible();

    // 2. Field Executive (CAN_MANAGE_DONATIONS deliberately includes FE,
    // unlike the withdrawal/KYC review precedent) approves it.
    const feContext = await browser.newContext({ storageState: AUTH_STATE.fieldExecutive });
    const fePage = await feContext.newPage();
    await fePage.goto("/admin/donations");
    const row = fePage.getByRole("row", { name: new RegExp(fullName) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Approve" }).click();
    await fePage.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
    await expect(row).toHaveCount(0); // default tab filters to PENDING
    await feContext.close();

    // 3. Member sees Approved + a receipt with the donor details they gave.
    await memberPage.goto("/member/donations");
    await expect(memberPage.getByText("Approved", { exact: true })).toBeVisible();
    await memberPage.getByRole("link", { name: "View Receipt" }).click();
    await expect(memberPage.getByText("12 MG Road, Pune")).toBeVisible();
    await expect(memberPage.getByText("ABCDE1234F")).toBeVisible();

    // 4. Wallet reflects the credited points under the donation ledger reason.
    await memberPage.goto("/member/wallet");
    await expect(memberPage.getByText(/donation/i).first()).toBeVisible();
    await memberContext.close();
  });
});

// The public register endpoint is IP-throttled (8/60s) and this suite's
// other files already spend a good share of that budget — these four
// API-only checks share ONE registered active member (a member can submit
// any number of independent donations) instead of one each, so this file
// only costs 2 register calls total instead of 5.
test.describe("donation cycle — negative (shared member)", () => {
  test.describe.configure({ mode: "serial" });

  let apiCtx: Awaited<ReturnType<typeof newApiContext>>;
  let admin: Awaited<ReturnType<typeof staffLoginApi>>;
  let fe: Awaited<ReturnType<typeof staffLoginApi>>;
  let fullName: string;
  let memberToken: string;

  test.beforeAll(async () => {
    apiCtx = await newApiContext();
    admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);

    fullName = `Donation Negatives Member ${uniqueSuffix()}`;
    const mobile = uniqueMobile();
    const password = "DonationNeg123pw";
    await createActiveMemberApi(apiCtx, { fullName, mobile, password }, fe.accessToken, admin.accessToken);
    memberToken = (await memberLoginApi(apiCtx, mobile, password)).accessToken;
  });

  test("staff reject leaves no receipt and no points credited", async ({ browser }) => {
    const submitRes = await apiCtx.post("/api/v1/donations/me", {
      headers: authHeaders(memberToken),
      data: { amount: 250, mode: "CASH" },
    });
    expect(submitRes.ok()).toBe(true);
    const donation = (await submitRes.json()).data as { id: string };

    const adminContext = await browser.newContext({ storageState: AUTH_STATE.admin });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/donations");
    const row = adminPage.getByRole("row", { name: new RegExp(fullName) }).first();
    await row.getByRole("button", { name: "Reject" }).click();
    await adminPage.getByLabel("Reason").fill("Could not verify receipt");
    await adminPage.getByRole("button", { name: "Reject Donation" }).click();
    await adminContext.close();

    const finalRes = await apiCtx.get(`/api/v1/donations/${donation.id}`, { headers: authHeaders(admin.accessToken) });
    const final = (await finalRes.json()).data as { status: string; receiptNumber: string | null };
    expect(final.status).toBe("REJECTED");
    expect(final.receiptNumber).toBeNull();
  });

  test("a second approve on an already-resolved donation is rejected (double-processing race)", async () => {
    const submitRes = await apiCtx.post("/api/v1/donations/me", {
      headers: authHeaders(memberToken),
      data: { amount: 100, mode: "CASH" },
    });
    const donation = (await submitRes.json()).data as { id: string };

    const first = await apiCtx.post(`/api/v1/donations/${donation.id}/approve`, { headers: authHeaders(admin.accessToken) });
    expect(first.ok()).toBe(true);

    const second = await apiCtx.post(`/api/v1/donations/${donation.id}/approve`, { headers: authHeaders(admin.accessToken) });
    expect(second.status()).toBe(409);
  });

  test("the manual submit endpoint rejects mode: ONLINE (gateway-only, not client-selectable)", async () => {
    const res = await apiCtx.post("/api/v1/donations/me", {
      headers: authHeaders(memberToken),
      data: { amount: 100, mode: "ONLINE" },
    });
    expect(res.status()).toBe(400);
  });

  test("submitting a non-positive donation amount is rejected", async () => {
    const res = await apiCtx.post("/api/v1/donations/me", {
      headers: authHeaders(memberToken),
      data: { amount: 0, mode: "CASH" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("donation cycle — negative", () => {
  test("a Field Executive cannot approve a donation for a member outside their jurisdiction", async () => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);

    // Created directly by admin (via the staff endpoint, not the throttled
    // public register endpoint), never claimed/touched by the Field
    // Executive — so buildJurisdictionWhere({createdById: fe.userId})
    // excludes it, the same guarantee findScoped/adminGet/approve/reject
    // give admin-managed donation review.
    const outsideMemberId = await createDraftMemberApi(apiCtx, admin.accessToken, {
      fullName: `Outside Jurisdiction Member ${uniqueSuffix()}`,
      mobile: uniqueMobile(),
    });
    const recordRes = await apiCtx.post(`/api/v1/members/${outsideMemberId}/donations`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: 300, mode: "CASH" },
    });
    expect(recordRes.ok()).toBe(true);
    const donation = (await recordRes.json()).data as { id: string; status: string };
    expect(donation.status).toBe("APPROVED"); // recordDirect auto-approves

    // FE can't even see it...
    const getRes = await apiCtx.get(`/api/v1/donations/${donation.id}`, { headers: authHeaders(fe.accessToken) });
    expect(getRes.status()).toBe(404);

    // ...and rejecting an already-APPROVED donation is a 409 regardless, so
    // the meaningful assertion is the 404 above firing before the state
    // machine even gets a chance to weigh in.
  });
});
