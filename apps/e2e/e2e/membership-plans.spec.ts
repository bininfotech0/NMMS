import { test, expect } from "@playwright/test";
import { AUTH_STATE, uniqueSuffix } from "./support/constants";

test.describe("membership plans — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("create a Lifetime plan (no duration field), then edit it to Fixed-duration", async ({ page }) => {
    const name = `Timeless Plan ${uniqueSuffix()}`;
    await page.goto("/admin/membership");
    await page.getByRole("button", { name: "Add Plan" }).click();
    await page.getByLabel("Plan name").fill(name);
    await page.getByLabel("Fee (₹)").fill("500");
    // Default validity type is "Fixed duration" (MONTHS) — switch to Lifetime.
    await page.locator("#validityType").selectOption("LIFETIME");
    await expect(page.getByLabel("Duration (months)")).toHaveCount(0);
    await page.getByRole("button", { name: "Create Plan" }).click();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row.getByText("Lifetime")).toBeVisible();

    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Duration (months)")).toHaveCount(0);
    await page.locator("#validityType").selectOption("MONTHS");
    await expect(page.getByLabel("Duration (months)")).toBeVisible();
    await page.getByLabel("Duration (months)").fill("24");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(row.getByText("24 months")).toBeVisible();
  });

  test("create a Fixed-duration plan, then edit it back to Lifetime clears the duration", async ({ page }) => {
    const name = `Fixed Duration Plan ${uniqueSuffix()}`;
    await page.goto("/admin/membership");
    await page.getByRole("button", { name: "Add Plan" }).click();
    await page.getByLabel("Plan name").fill(name);
    await page.getByLabel("Fee (₹)").fill("300");
    await page.getByLabel("Duration (months)").fill("12");
    await page.getByRole("button", { name: "Create Plan" }).click();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row.getByText("12 months")).toBeVisible();

    await row.getByRole("button", { name: "Edit" }).click();
    await page.locator("#validityType").selectOption("LIFETIME");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(row.getByText("Lifetime")).toBeVisible();
  });

  test("Activate/Deactivate toggle flips the status badge", async ({ page }) => {
    const name = `Toggle Plan ${uniqueSuffix()}`;
    await page.goto("/admin/membership");
    await page.getByRole("button", { name: "Add Plan" }).click();
    await page.getByLabel("Plan name").fill(name);
    await page.getByLabel("Fee (₹)").fill("100");
    await page.getByLabel("Duration (months)").fill("6");
    await page.getByRole("button", { name: "Create Plan" }).click();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row.getByText("Active", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Activate" }).click();
    await expect(row.getByText("Active", { exact: true })).toBeVisible();
  });
});

test.describe("membership plans — field executive", () => {
  test.use({ storageState: AUTH_STATE.fieldExecutive });

  test("Add Plan button and the Actions column are absent", async ({ page }) => {
    await page.goto("/admin/membership");
    await expect(page.getByRole("button", { name: "Add Plan" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });
});
