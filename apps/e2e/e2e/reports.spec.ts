import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./support/constants";

const REPORT_TABS = [
  "Member Register",
  "Pending Approval",
  "Rejected Applications",
  "Payment Collection",
  "Membership Renewal",
  "Branch Wise Members",
  "Field Executive Performance",
  "Revenue Collection",
];

test.describe("reports — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("summary cards, charts, and every detailed report tab render", async ({ page }) => {
    await page.goto("/admin/reports");
    await expect(page.getByText("Total Members", { exact: true })).toBeVisible();
    await expect(page.getByText("Active Members", { exact: true })).toBeVisible();
    await expect(page.getByText("Total Collected", { exact: true })).toBeVisible();
    await expect(page.getByText("Member Growth (12 months)")).toBeVisible();
    await expect(page.getByText("Collections (12 months)")).toBeVisible();
    await expect(page.getByText("Detailed Reports")).toBeVisible();

    for (const tab of REPORT_TABS) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
      // Every table has either data rows or an explicit empty-state message —
      // either way the report content area itself must render without error.
      await expect(page.locator("table")).toBeVisible();
    }
  });

  test("Export CSV downloads a non-empty file for Member Register and Revenue Collection", async ({ page }) => {
    await page.goto("/admin/reports");

    await page.getByRole("button", { name: "Member Register", exact: true }).click();
    const exportButton = page.getByRole("button", { name: "Export CSV" });
    await expect(exportButton).toBeEnabled();
    const [memberDownload] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
    expect(memberDownload.suggestedFilename()).toBe("member-register.csv");

    await page.getByRole("button", { name: "Revenue Collection", exact: true }).click();
    const revenueExportButton = page.getByRole("button", { name: "Export CSV" });
    await expect(revenueExportButton).toBeEnabled();
    const [revenueDownload] = await Promise.all([page.waitForEvent("download"), revenueExportButton.click()]);
    expect(revenueDownload.suggestedFilename()).toBe("revenue-collection.csv");
  });
});

test.describe("reports — field executive", () => {
  test.use({ storageState: AUTH_STATE.fieldExecutive });

  // /reports/summary is intentionally open to Field Executive too (scoped by
  // their own jurisdiction — see ReportsController's SUMMARY_ROLES comment),
  // unlike the detailed per-report endpoints below which stay ADMIN/SUPER_ADMIN
  // only (REVIEWER_ROLES).
  test("sees the summary cards (jurisdiction-scoped) but a detailed report tab degrades instead of crashing", async ({
    page,
  }) => {
    await page.goto("/admin/reports");
    await expect(page.getByText("Total Members", { exact: true })).toBeVisible();
    await expect(page.getByText("You don't have permission to view reports.")).toHaveCount(0);

    await page.getByRole("button", { name: "Member Register", exact: true }).click();
    await expect(page.getByText("Failed to load data.")).toBeVisible();
  });
});
