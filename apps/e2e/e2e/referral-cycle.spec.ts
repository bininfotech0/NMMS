import { test, expect } from "@playwright/test";
import {
  E2E_BASELINE_PLAN_FEE,
  bringMemberToAwaitingPaymentApi,
  createActiveMemberApi,
  ensureTieredPlan,
  memberLoginApi,
  newApiContext,
  staffLoginApi,
} from "./support/api";
import { armThrottleRetry } from "./support/throttle-retry";
import { AUTH_STATE, E2E_ADMIN, E2E_FIELD_EXECUTIVE, uniqueAadhaar, uniqueMobile, uniqueSuffix } from "./support/constants";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test("full referral cycle: link -> self-registration -> claim -> approval -> points/rank/reward -> fulfillment", async ({
  browser,
}) => {
  const referrerName = `Referrer A ${uniqueSuffix()}`;
  const referrerMobile = uniqueMobile();
  const referrerPassword = "ReferrerA123pw";

  const apiCtx = await newApiContext();
  const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
  const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);

  // Org settings are real, shared DB state another test/run can leave
  // changed (e.g. settings-org.spec.ts's own points-per-referral coverage) —
  // pin the value this test's "+10" assertion depends on rather than
  // assuming whatever's ambient.
  await apiCtx.patch("/api/v1/org", {
    headers: authHeaders(admin.accessToken),
    data: { pointsPerApprovedReferral: 10 },
  });

  // A SILVER-tier plan so the referrer's own activation grants their Silver
  // volunteer-batch reward (ReferralsService.awardBatchRewardForTier) — the
  // untiered E2E Baseline Plan never does, since batch/rewards are now keyed
  // off plan tier rather than referral points earned.
  const silverPlanId = await ensureTieredPlan(apiCtx, admin.accessToken, "SILVER");
  const referrerId = await createActiveMemberApi(
    apiCtx,
    { fullName: referrerName, mobile: referrerMobile, password: referrerPassword },
    admin.accessToken,
    admin.accessToken,
    silverPlanId,
  );

  // The "correct answer" for the referral link — fetched independently via
  // API so the UI "Copy" assertion below actually validates something.
  const { accessToken: referrerToken } = await memberLoginApi(apiCtx, referrerMobile, referrerPassword);
  const summaryRes = await apiCtx.get("/api/v1/referrals/me", { headers: authHeaders(referrerToken) });
  const referrerSummary = (await summaryRes.json()).data as { referralCode: string };

  // 1. Referrer A logs into the member portal and copies their referral link.
  const memberAContext = await browser.newContext();
  await memberAContext.grantPermissions(["clipboard-read", "clipboard-write"]);
  const memberAPage = await memberAContext.newPage();
  await armThrottleRetry(memberAPage);
  await memberAPage.goto("/login");
  await memberAPage.getByLabel("Mobile number").fill(referrerMobile);
  await memberAPage.getByLabel("Password").fill(referrerPassword);
  await memberAPage.getByRole("button", { name: "Sign In" }).click();
  await memberAPage.waitForURL("**/member");
  // Derived from the page's own origin rather than hardcoded, so this
  // assertion holds under whatever baseURL the suite is actually run against.
  const expectedLink = `${new URL(memberAPage.url()).origin}/join?ref=${referrerSummary.referralCode}`;
  await memberAPage.getByRole("button", { name: "Copy" }).click();
  const copiedLink = await memberAPage.evaluate(() => navigator.clipboard.readText());
  expect(copiedLink).toBe(expectedLink);

  // 2. A stranger self-registers via that link (fresh, unauthenticated context).
  const joinContext = await browser.newContext();
  const joinPage = await joinContext.newPage();
  await armThrottleRetry(joinPage);
  const refereeName = `Referee B ${uniqueSuffix()}`;
  const refereeMobile = uniqueMobile();
  await joinPage.goto(copiedLink);
  await expect(joinPage.getByText(new RegExp(referrerName))).toBeVisible();
  await joinPage.getByLabel("Full name").fill(refereeName);
  await joinPage.getByLabel("Mobile number").fill(refereeMobile);
  await joinPage.getByLabel("Aadhaar number").fill(uniqueAadhaar(refereeMobile));
  await joinPage.getByLabel("Create a password").fill("RefereeB123pw");
  await joinPage.getByRole("button", { name: "Join now" }).click();
  await joinPage.waitForURL("**/member");
  await joinContext.close();

  // 3. The Field Executive claims the unclaimed self-registration.
  const feContext = await browser.newContext({ storageState: AUTH_STATE.fieldExecutive });
  const fePage = await feContext.newPage();
  await fePage.goto("/admin/applications");
  await expect(fePage.getByText(new RegExp(`Unclaimed Referral Sign-ups`))).toBeVisible();
  const refereeCard = fePage.locator("li").filter({ hasText: refereeName });
  await refereeCard.getByRole("button", { name: "Claim & Confirm" }).click();
  await expect(fePage.getByText(refereeName)).toHaveCount(0);
  await feContext.close();

  // 4. Bring the referee through submission/payment (mechanics already
  // covered by applications-lifecycle.spec.ts — API here keeps this test
  // focused on the referral-specific points/rank/reward assertions below).
  // Paying auto-activates the referee — no separate approval call.
  const membersRes = await apiCtx.get("/api/v1/members", { headers: authHeaders(admin.accessToken) });
  const allMembers = (await membersRes.json()).data as Array<{ id: string; fullName: string }>;
  const refereeId = allMembers.find((m) => m.fullName === refereeName)!.id;
  await bringMemberToAwaitingPaymentApi(apiCtx, fe.accessToken, refereeId);
  await apiCtx.post(`/api/v1/members/${refereeId}/payments`, {
    headers: authHeaders(fe.accessToken),
    data: { amount: E2E_BASELINE_PLAN_FEE, mode: "CASH" },
  });

  // 5. Referrer A's Wallet reflects the new points from the referee's approval.
  await memberAPage.goto("/member/wallet");
  await expect(memberAPage.getByText(new RegExp(`${refereeName} joined and was approved`))).toBeVisible();
  await expect(memberAPage.getByText("+10", { exact: true })).toBeVisible();

  // Volunteer batch/rewards no longer come from points — Referrer A's Silver
  // reward was granted back at their own activation (SILVER-tier plan above),
  // independent of the referral just completed.
  await memberAPage.goto("/member/rewards");
  await expect(memberAPage.getByText("Silver", { exact: true }).first()).toBeVisible();
  await memberAContext.close();

  // 6. Admin sees the pending reward and fulfills it. A Silver-tier
  // activation cascades (tiersUpTo) and grants the Bronze reward too, so
  // there are two rows for this referrer here — scope to the Silver one and
  // separately confirm the cascaded Bronze row is also present.
  const adminContext = await browser.newContext({ storageState: AUTH_STATE.admin });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin/referral-rewards");
  const rewardRows = adminPage.getByRole("row", { name: new RegExp(referrerName) });
  await expect(rewardRows).toHaveCount(2);
  const bronzeRow = rewardRows.filter({ hasText: "Bronze" });
  await expect(bronzeRow).toBeVisible();
  await expect(bronzeRow.getByText("Pending", { exact: true })).toBeVisible();
  const rewardRow = rewardRows.filter({ hasText: "Silver" });
  await expect(rewardRow).toBeVisible();
  await expect(rewardRow.getByText("Pending", { exact: true })).toBeVisible();
  await rewardRow.getByRole("button", { name: "Mark Fulfilled" }).click();
  // The default tab filters to status=PENDING, so a just-fulfilled row drops
  // out of the current view rather than updating in place — check the "All"
  // tab for the new status instead of expecting the row to stay put.
  await expect(rewardRow).toHaveCount(0);
  await adminPage.getByRole("button", { name: "All" }).click();
  const rewardRowAll = adminPage.getByRole("row", { name: new RegExp(referrerName) }).filter({ hasText: "Silver" });
  await expect(rewardRowAll.getByText("Fulfilled", { exact: true })).toBeVisible();
  await expect(rewardRowAll.getByRole("button", { name: "Mark Fulfilled" })).toHaveCount(0);
  await adminContext.close();

  // 7. Field Executive hitting the admin-only Referral Rewards page degrades
  // gracefully (server-enforced 403) rather than crashing — the sidebar nav
  // item is shown to all roles even though the underlying API is admin-only.
  const feContext2 = await browser.newContext({ storageState: AUTH_STATE.fieldExecutive });
  const fePage2 = await feContext2.newPage();
  await fePage2.goto("/admin/referral-rewards");
  await expect(fePage2.getByRole("heading", { name: "Referral Rewards" })).toBeVisible();
  await feContext2.close();

  void referrerId;
  await apiCtx.dispose();
});
