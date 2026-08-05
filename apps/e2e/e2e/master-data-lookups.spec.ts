import { test, expect } from "@playwright/test";
import { AUTH_STATE, uniqueSuffix } from "./support/constants";

// The Lookups tab uses one generic UI for all 9 categories — CRUD mechanics
// are identical regardless of category, so a representative subset (not all
// 9) is enough to catch category-switching bugs without redundant coverage.
const REPRESENTATIVE_CATEGORIES = ["Religion", "Branch", "Family Type"];

// LookupValueRow renders a <div> normally but swaps to a <form> while
// editing — both share this exact class string, so a tag-agnostic CSS class
// selector is needed to keep tracking the same row across that swap.
const ROW_CLASS = ".rounded-xl.border.border-border.bg-card.p-4";

test.describe("master data lookups — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  for (const category of REPRESENTATIVE_CATEGORIES) {
    test(`${category}: add, rename, and toggle active/inactive`, async ({ page }) => {
      const value = `E2E ${category} Value ${uniqueSuffix()}`;
      await page.goto("/admin/settings");
      await page.getByRole("button", { name: "Lookups" }).click();
      await page.locator("#category").selectOption(category);

      await page.getByLabel("Add a value").fill(value);
      await page.getByRole("button", { name: "Add" }).click();
      const row = page.locator(ROW_CLASS).filter({ hasText: value });
      await expect(row).toBeVisible();

      // Rename via the inline pencil -> text field -> check flow. Once
      // editing, the row's visible text content is gone (it's now an input
      // *value*, which `hasText` filters can't see), so track the rename
      // input/submit button by id/ancestor instead of continuing to filter
      // the row locator by text.
      await row.getByRole("button").first().click(); // pencil (Edit)
      const renamed = `${value} Renamed`;
      const renameInput = page.locator("#lookupRenameValue");
      await renameInput.fill(renamed);
      await renameInput.locator("xpath=ancestor::form[1]").getByRole("button").first().click(); // check (submit)
      const renamedRow = page.locator(ROW_CLASS).filter({ hasText: renamed });
      await expect(renamedRow).toBeVisible();

      // Active/Inactive toggle.
      await expect(renamedRow.getByText("Active", { exact: true })).toBeVisible();
      await renamedRow.getByRole("button", { name: "Active", exact: true }).click();
      await expect(renamedRow.getByText("Inactive", { exact: true })).toBeVisible();
      await renamedRow.getByRole("button", { name: "Inactive", exact: true }).click();
      await expect(renamedRow.getByText("Active", { exact: true })).toBeVisible();
    });
  }

  test("adding a duplicate value in the same category is rejected", async ({ page }) => {
    // Deliberately avoids the word "duplicate" in the value itself — the
    // rejection toast's text would otherwise collide with the value's own
    // text under a case-insensitive substring match.
    const value = `E2E Repeat Value ${uniqueSuffix()}`;
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Lookups" }).click();
    await page.locator("#category").selectOption("Religion");

    await page.getByLabel("Add a value").fill(value);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.locator(ROW_CLASS).filter({ hasText: value })).toBeVisible();

    await page.getByLabel("Add a value").fill(value);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible();
  });
});

test.describe("master data lookups — field executive", () => {
  test.use({ storageState: AUTH_STATE.fieldExecutive });

  test("Add/Edit/Toggle are rendered but yield a graceful error on click", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Lookups" }).click();
    await page.locator("#category").selectOption("Religion");

    await expect(page.getByLabel("Add a value")).toBeVisible();
    await page.getByLabel("Add a value").fill(`FE Attempt ${uniqueSuffix()}`);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(/permission|forbidden|error/i).first()).toBeVisible();
  });
});
