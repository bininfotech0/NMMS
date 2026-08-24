import { test, expect } from "@playwright/test";
import { createActiveMemberApi, memberLoginApi, newApiContext, staffLoginApi } from "./support/api";
import { armThrottleRetry } from "./support/throttle-retry";
import { AUTH_STATE, E2E_ADMIN, E2E_FIELD_EXECUTIVE, uniqueMobile, uniqueSuffix } from "./support/constants";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Pins the settings this whole file's amount math depends on — real, shared
// DB state another test/run (e.g. settings-org.spec.ts) can leave changed,
// same reasoning as referral-cycle.spec.ts's own pointsPerApprovedReferral
// pin. 100 points = ₹10, ₹10 minimum, no charge — donating ₹500 at 100%
// yields exactly 500 points to work with.
async function pinWithdrawalSettings(apiCtx: Awaited<ReturnType<typeof newApiContext>>, adminToken: string) {
  await apiCtx.patch("/api/v1/org", {
    headers: authHeaders(adminToken),
    data: {
      pointsToMoneyRatioPoints: 100,
      pointsToMoneyRatioAmount: 10,
      withdrawalMinAmount: 10,
      withdrawalMaxAmount: null,
      withdrawalFrequencyDays: null,
      withdrawalChargeType: "NONE",
      donationPointsPercent: 100,
    },
  });
}

test.describe("withdrawal cycle — positive", () => {
  test("submit KYC -> verified -> request withdrawal -> approve -> mark paid", async ({ browser }) => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    await pinWithdrawalSettings(apiCtx, admin.accessToken);

    const fullName = `Withdrawal Cycle Member ${uniqueSuffix()}`;
    const mobile = uniqueMobile();
    const password = "WithdrawCycle123pw";
    const memberId = await createActiveMemberApi(
      apiCtx,
      { fullName, mobile, password },
      fe.accessToken,
      admin.accessToken,
    );

    // Give the member points to withdraw — a direct staff-recorded donation
    // is the simplest deterministic earning channel already covered
    // end-to-end elsewhere (donations-cycle.spec.ts); this test's own focus
    // is the withdrawal state machine, not how the points got there.
    const donationRes = await apiCtx.post(`/api/v1/members/${memberId}/donations`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: 500, mode: "CASH" },
    });
    expect(donationRes.ok(), await donationRes.text()).toBe(true);

    // 1. Member submits KYC (UPI, the simpler of the two payout methods) via
    // the real login + form UI.
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await armThrottleRetry(memberPage);
    await memberPage.goto("/login");
    await memberPage.getByLabel("Mobile number").fill(mobile);
    await memberPage.getByLabel("Password").fill(password);
    await memberPage.getByRole("button", { name: "Sign In" }).click();
    await memberPage.waitForURL("**/member");

    await memberPage.goto("/member/kyc");
    await memberPage.getByRole("button", { name: "UPI" }).click();
    await memberPage.getByLabel("UPI ID").fill("withdrawcycle@okhdfc");
    await memberPage.getByRole("button", { name: "Submit for review" }).click();
    await expect(memberPage.getByText("Under review")).toBeVisible();

    // Withdraw isn't offered yet — KYC is still PENDING.
    await memberPage.goto("/member/wallet");
    await expect(memberPage.getByRole("button", { name: "Withdraw" })).toHaveCount(0);

    // 2. Admin verifies it via the KYC review queue.
    const adminContext = await browser.newContext({ storageState: AUTH_STATE.admin });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/kyc");
    const kycRow = adminPage.getByRole("row", { name: new RegExp(fullName) });
    await expect(kycRow).toBeVisible();
    await kycRow.getByRole("button", { name: "Review" }).click();
    await adminPage.getByRole("button", { name: "Verify" }).click();
    await expect(adminPage.getByRole("button", { name: "Verify" })).toHaveCount(0);

    // 3. Member requests a withdrawal now that KYC is VERIFIED.
    await memberPage.goto("/member/wallet");
    await expect(memberPage.getByRole("button", { name: "Withdraw" })).toBeVisible();
    await memberPage.getByRole("button", { name: "Withdraw" }).click();
    await memberPage.getByLabel("Points to withdraw").fill("200");
    await expect(memberPage.getByText("You receive")).toBeVisible();
    await memberPage.getByRole("button", { name: "Request Withdrawal" }).click();
    await expect(memberPage.getByText("Pending", { exact: true })).toBeVisible();

    // 4. Admin approves, then marks it paid.
    await adminPage.goto("/admin/withdrawals");
    const row = adminPage.getByRole("row", { name: new RegExp(fullName) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Approve" }).click();
    await adminPage.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
    await expect(row).toHaveCount(0); // default tab filters to PENDING

    await adminPage.getByRole("button", { name: "Approved" }).click();
    const approvedRow = adminPage.getByRole("row", { name: new RegExp(fullName) });
    await approvedRow.getByRole("button", { name: "Mark Paid" }).click();
    await adminPage.getByLabel("Payment reference (optional)").fill("UTR-CYCLE-TEST-1");
    await adminPage.getByRole("button", { name: "Mark Paid" }).click();

    // 5. Member's wallet reflects the converted points and paid-out amount.
    await memberPage.goto("/member/wallet");
    await expect(memberPage.getByText(/withdrawal paid out/i)).toBeVisible();
    // "₹20" (200 points / 100 * ₹10) appears both on the summary card and
    // inside the request row's own "200 pts · ₹20 net" line.
    await expect(memberPage.getByText("₹20", { exact: true })).toBeVisible();

    await memberContext.close();
    await adminContext.close();
  });
});

test.describe("withdrawal cycle — negative", () => {
  test("a request is rejected when KYC has never been verified", async () => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    await pinWithdrawalSettings(apiCtx, admin.accessToken);

    const mobile = uniqueMobile();
    const password = "NoKyc123pw";
    await createActiveMemberApi(
      apiCtx,
      { fullName: `No Kyc Member ${uniqueSuffix()}`, mobile, password },
      fe.accessToken,
      admin.accessToken,
    );
    const { accessToken: memberToken } = await memberLoginApi(apiCtx, mobile, password);

    const res = await apiCtx.post("/api/v1/withdrawals/me", {
      headers: authHeaders(memberToken),
      data: { pointsRequested: 100 },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/KYC verification is required/i);
  });

  test("a request below the minimum withdrawal amount is rejected", async () => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    await pinWithdrawalSettings(apiCtx, admin.accessToken);

    const mobile = uniqueMobile();
    const password = "BelowMin123pw";
    const memberId = await createActiveMemberApi(
      apiCtx,
      { fullName: `Below Min Member ${uniqueSuffix()}`, mobile, password },
      fe.accessToken,
      admin.accessToken,
    );
    const { accessToken: memberToken } = await memberLoginApi(apiCtx, mobile, password);
    await apiCtx.put("/api/v1/kyc/me", { headers: authHeaders(memberToken), data: { payoutMethod: "UPI", upiId: "belowmin@okhdfc" } });
    await apiCtx.post(`/api/v1/kyc/${memberId}/verify`, { headers: authHeaders(admin.accessToken) });
    await apiCtx.post(`/api/v1/members/${memberId}/donations`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: 500, mode: "CASH" },
    });

    // 5 points -> gross ₹0.50, below the pinned ₹10 minimum.
    const res = await apiCtx.post("/api/v1/withdrawals/me", {
      headers: authHeaders(memberToken),
      data: { pointsRequested: 5 },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/Minimum withdrawal amount/i);
  });

  test("a request exceeding the available balance is rejected", async () => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    await pinWithdrawalSettings(apiCtx, admin.accessToken);

    const mobile = uniqueMobile();
    const password = "OverBalance123pw";
    const memberId = await createActiveMemberApi(
      apiCtx,
      { fullName: `Over Balance Member ${uniqueSuffix()}`, mobile, password },
      fe.accessToken,
      admin.accessToken,
    );
    const { accessToken: memberToken } = await memberLoginApi(apiCtx, mobile, password);
    await apiCtx.put("/api/v1/kyc/me", { headers: authHeaders(memberToken), data: { payoutMethod: "UPI", upiId: "overbalance@okhdfc" } });
    await apiCtx.post(`/api/v1/kyc/${memberId}/verify`, { headers: authHeaders(admin.accessToken) });
    await apiCtx.post(`/api/v1/members/${memberId}/donations`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: 100, mode: "CASH" }, // 100 points at 100%
    });

    const res = await apiCtx.post("/api/v1/withdrawals/me", {
      headers: authHeaders(memberToken),
      data: { pointsRequested: 1000 },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/Insufficient available balance/i);
  });

  test("staff reject leaves the request unpaid, and a second approve on it is refused", async () => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    await pinWithdrawalSettings(apiCtx, admin.accessToken);

    const mobile = uniqueMobile();
    const password = "RejectCycle123pw";
    const memberId = await createActiveMemberApi(
      apiCtx,
      { fullName: `Withdrawal Reject Member ${uniqueSuffix()}`, mobile, password },
      fe.accessToken,
      admin.accessToken,
    );
    const { accessToken: memberToken } = await memberLoginApi(apiCtx, mobile, password);
    await apiCtx.put("/api/v1/kyc/me", { headers: authHeaders(memberToken), data: { payoutMethod: "UPI", upiId: "rejectcycle@okhdfc" } });
    await apiCtx.post(`/api/v1/kyc/${memberId}/verify`, { headers: authHeaders(admin.accessToken) });
    await apiCtx.post(`/api/v1/members/${memberId}/donations`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: 500, mode: "CASH" },
    });

    const createRes = await apiCtx.post("/api/v1/withdrawals/me", {
      headers: authHeaders(memberToken),
      data: { pointsRequested: 200 },
    });
    expect(createRes.ok(), await createRes.text()).toBe(true);
    const request = (await createRes.json()).data as { id: string };

    const rejectRes = await apiCtx.post(`/api/v1/withdrawals/${request.id}/reject`, {
      headers: authHeaders(admin.accessToken),
      data: { note: "Bank details could not be confirmed" },
    });
    expect(rejectRes.ok(), await rejectRes.text()).toBe(true);
    const rejected = (await rejectRes.json()).data as { status: string };
    expect(rejected.status).toBe("REJECTED");

    // Rejected is a closed state — approving it now is a 409, not a silent no-op.
    const approveRes = await apiCtx.post(`/api/v1/withdrawals/${request.id}/approve`, {
      headers: authHeaders(admin.accessToken),
    });
    expect(approveRes.status()).toBe(409);
  });
});
