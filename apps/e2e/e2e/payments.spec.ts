import { test, expect } from "@playwright/test";
import { createDraftMemberApi, ensureActivePlan, newApiContext, staffLoginApi } from "./support/api";
import { AUTH_STATE, E2E_ADMIN, uniqueMobile, uniqueSuffix } from "./support/constants";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe("payments — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("Outstanding: search filters, Collect records an offline payment, row moves to History", async ({ page }) => {
    const name = `Outstanding Member ${uniqueSuffix()}`;
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const memberId = await createDraftMemberApi(apiCtx, admin.accessToken, { fullName: name, mobile: uniqueMobile() });
    const planId = await ensureActivePlan(apiCtx, admin.accessToken);
    await apiCtx.patch(`/api/v1/members/${memberId}`, {
      headers: authHeaders(admin.accessToken),
      data: { planId },
    });
    await apiCtx.dispose();

    await page.goto("/admin/payments");
    // exact: true — the topbar's wallet icon has a title like "No outstanding
    // payments" / "N members with outstanding payment", which otherwise also
    // matches this non-exact query.
    await expect(page.getByRole("button", { name: "Outstanding", exact: true })).toBeVisible();

    await page.getByPlaceholder("Search members...").fill("zzz-no-such-outstanding-member-zzz");
    await expect(page.getByText(name)).toHaveCount(0);
    await page.getByPlaceholder("Search members...").fill(name);
    const outstandingRow = page.getByRole("row", { name: new RegExp(name) });
    await expect(outstandingRow).toBeVisible();

    await outstandingRow.getByRole("button", { name: "Collect" }).click();
    await expect(page.getByText(`Collecting payment from ${name}.`)).toBeVisible();
    const offlineToggle = page.getByRole("button", { name: "Record an offline payment instead" });
    if (await offlineToggle.count()) {
      await offlineToggle.click();
    }
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(page.getByText(`Collecting payment from ${name}.`)).toHaveCount(0);

    await page.getByPlaceholder("Search members...").fill(name);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);

    await page.getByRole("button", { name: "History" }).click();
    // History's search filters on raw receiptNumber/memberId fields, not the
    // rendered member name — search by the member's id instead.
    await page.getByPlaceholder("Search by receipt, member...").fill(memberId);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  });

  test("History: per-row Print opens a correctly populated receipt page", async ({ page }) => {
    const name = `Receipt Member ${uniqueSuffix()}`;
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const memberId = await createDraftMemberApi(apiCtx, admin.accessToken, { fullName: name, mobile: uniqueMobile() });
    const planId = await ensureActivePlan(apiCtx, admin.accessToken);
    await apiCtx.patch(`/api/v1/members/${memberId}`, { headers: authHeaders(admin.accessToken), data: { planId } });
    await apiCtx.post(`/api/v1/members/${memberId}/payments`, {
      headers: authHeaders(admin.accessToken),
      data: { amount: 123, mode: "CASH" },
    });
    await apiCtx.dispose();

    await page.goto("/admin/payments");
    await page.getByRole("button", { name: "History" }).click();
    // History's search filters on raw receiptNumber/memberId fields, not the
    // rendered member name — search by the member's id instead.
    await page.getByPlaceholder("Search by receipt, member...").fill(memberId);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("link").click();
    await page.waitForURL(/\/payments\/[^/]+\/receipt/);
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Profile" }).click();
    await page.waitForURL(new RegExp(`/admin/members/${memberId}/profile`));
  });
});
