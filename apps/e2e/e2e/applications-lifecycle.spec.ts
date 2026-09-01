import { test, expect } from "@playwright/test";
import {
  E2E_BASELINE_PLAN_FEE,
  bringMemberToAwaitingPaymentApi,
  createActiveMemberApi,
  createDraftMemberApi,
  memberRegisterApi,
  newApiContext,
  staffLoginApi,
} from "./support/api";
import { AUTH_STATE, E2E_ADMIN, E2E_FIELD_EXECUTIVE, uniqueMobile, uniqueSuffix } from "./support/constants";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe("applications lifecycle — admin", () => {
  // Pinned explicitly rather than relying on `--project` at invocation time —
  // this file mixes two roles across its two describe blocks, so it must be
  // correct no matter which CLI --project flag (if any) wraps the run.
  test.use({ storageState: AUTH_STATE.admin });

  test("paying an AWAITING_PAYMENT registration auto-activates it — no approval step or button", async ({ page }) => {
    const name = `Auto Activate Member ${uniqueSuffix()}`;
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const memberId = await createDraftMemberApi(apiCtx, admin.accessToken, { fullName: name, mobile: uniqueMobile() });
    await bringMemberToAwaitingPaymentApi(apiCtx, admin.accessToken, memberId);

    await page.goto("/admin/applications");
    const row = page.getByRole("row", { name });
    await expect(row).toBeVisible();
    // No manual approval action exists any more — only Reject, as a
    // fraud-prevention backstop before payment.
    await expect(row.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Reject" })).toBeVisible();

    await apiCtx.post(`/api/v1/members/${memberId}/payments`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: E2E_BASELINE_PLAN_FEE, mode: "CASH" },
    });
    await apiCtx.dispose();

    // Paid — the member drops out of the awaiting-payment queue entirely.
    await page.goto("/admin/applications");
    await expect(page.getByRole("row", { name })).toHaveCount(0);

    await page.goto(`/admin/members/${memberId}/profile`);
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText(/^MEM-/).first()).toBeVisible();
  });

  test("rejects an AWAITING_PAYMENT member with required remarks", async ({ page }) => {
    const name = `Reject Me Member ${uniqueSuffix()}`;
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const memberId = await createDraftMemberApi(apiCtx, admin.accessToken, { fullName: name, mobile: uniqueMobile() });
    await bringMemberToAwaitingPaymentApi(apiCtx, admin.accessToken, memberId);
    await apiCtx.dispose();

    await page.goto("/admin/applications");
    const row = page.getByRole("row", { name });
    await row.getByRole("button", { name: "Reject" }).click();
    await page.getByRole("button", { name: "Reject Application" }).click();
    // Reason is required — submitting empty must not close the sheet (Radix
    // applies aria-hidden to background content while it's open, so the
    // underlying row is unqueryable right now regardless; checking the sheet
    // itself is still open is the real signal that submission was blocked).
    await expect(page.getByRole("dialog", { name: "Reject Application" })).toBeVisible();
    await page.getByLabel("Reason for rejection").fill("Incomplete documents");
    await page.getByRole("button", { name: "Reject Application" }).click();
    await expect(row).toHaveCount(0);

    await page.goto(`/admin/members/${memberId}/profile`);
    await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  });

  test("full lifecycle: Suspend -> Reactivate -> Mark Deceased (terminal)", async ({ page }) => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const memberId = await createActiveMemberApi(
      apiCtx,
      { fullName: `Lifecycle Chain Member ${uniqueSuffix()}`, mobile: uniqueMobile(), password: "LifecycleChain123pw" },
      admin.accessToken,
      admin.accessToken,
    );
    await apiCtx.dispose();

    await page.goto(`/admin/members/${memberId}/profile`);
    await page.getByRole("button", { name: "Suspend" }).click();
    await page.getByLabel("Remarks").fill("Non-payment of dues");
    await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await expect(page.getByText("Suspended", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Reactivate" }).click();
    await page.getByLabel("Remarks").fill("Dues cleared");
    await page.getByRole("button", { name: "Reactivate", exact: true }).click();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Mark Deceased" }).click();
    await page.getByLabel("Remarks").fill("Reported by family");
    await page.getByRole("button", { name: "Mark Deceased", exact: true }).click();
    await expect(page.getByText("Deceased", { exact: true })).toBeVisible();
    // Terminal state — no further lifecycle actions offered.
    await expect(page.getByRole("button", { name: "Suspend" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reactivate" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark Deceased" })).toHaveCount(0);
  });

  test("Timeline tab shows every transition with actor and remarks", async ({ page }) => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const memberId = await createDraftMemberApi(apiCtx, admin.accessToken, {
      fullName: `Timeline Member ${uniqueSuffix()}`,
      mobile: uniqueMobile(),
    });
    await bringMemberToAwaitingPaymentApi(apiCtx, admin.accessToken, memberId);
    // Payment auto-activates — no separate approve() call any more.
    await apiCtx.post(`/api/v1/members/${memberId}/payments`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: E2E_BASELINE_PLAN_FEE, mode: "CASH" },
    });
    await apiCtx.dispose();

    await page.goto(`/admin/members/${memberId}/profile`);
    await page.getByRole("button", { name: "Timeline" }).click();
    await expect(page.getByText("Status Timeline")).toBeVisible();
    await expect(page.getByText("Awaiting Payment").first()).toBeVisible();
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  });
});

test.describe("applications lifecycle — field executive", () => {
  test.use({ storageState: AUTH_STATE.fieldExecutive });

  test("cannot reject a member they created directly (not self-registered)", async ({ page }) => {
    const name = `FE Direct Member ${uniqueSuffix()}`;
    const apiCtx = await newApiContext();
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    const memberId = await createDraftMemberApi(apiCtx, fe.accessToken, { fullName: name, mobile: uniqueMobile() });
    await bringMemberToAwaitingPaymentApi(apiCtx, fe.accessToken, memberId);
    await apiCtx.dispose();

    await page.goto("/admin/applications");
    const row = page.getByRole("row", { name });
    await expect(row.getByRole("button", { name: "Reject" })).toHaveCount(0);
  });

  test("can reject a self-registered member they claimed", async ({ page }) => {
    const name = `FE Claimed Member ${uniqueSuffix()}`;
    const apiCtx = await newApiContext();
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    const mobile = uniqueMobile();
    const registered = await memberRegisterApi(apiCtx, { fullName: name, mobile, password: "FeClaimed123pw" });
    const memberId = registered!.memberId;
    await apiCtx.post(`/api/v1/members/${memberId}/claim`, { headers: authHeaders(fe.accessToken) });
    await bringMemberToAwaitingPaymentApi(apiCtx, fe.accessToken, memberId);
    await apiCtx.dispose();

    await page.goto("/admin/applications");
    const row = page.getByRole("row", { name });
    await row.getByRole("button", { name: "Reject" }).click();
    await page.getByLabel("Reason for rejection").fill("Duplicate registration");
    await page.getByRole("button", { name: "Reject Application" }).click();
    await expect(row).toHaveCount(0);
  });

  test("Suspend/Reactivate/Mark Deceased buttons are never offered", async ({ page }) => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const memberId = await createActiveMemberApi(
      apiCtx,
      { fullName: `FE View Only Member ${uniqueSuffix()}`, mobile: uniqueMobile(), password: "FeViewOnly123pw" },
      admin.accessToken,
      admin.accessToken,
    );
    await apiCtx.dispose();

    await page.goto(`/admin/members/${memberId}/profile`);
    await expect(page.getByRole("button", { name: "Suspend" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reactivate" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark Deceased" })).toHaveCount(0);
  });
});
