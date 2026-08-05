import { test, expect } from "@playwright/test";
import { AUTH_STATE, uniqueSuffix } from "./support/constants";

test.describe("notices — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("Create Notice with 'Publish immediately' creates and publishes it right away", async ({ page }) => {
    const title = `E2E Published Notice ${uniqueSuffix()}`;
    await page.goto("/admin/notices");
    await page.getByRole("button", { name: "Create Notice" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("This notice was published immediately from an E2E test.");
    await page.locator("#audienceRole").selectOption("Everyone");
    await page.getByLabel("Publish immediately").check();
    await page.getByRole("button", { name: "Create & Publish" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Published", { exact: true })).toBeVisible();
    // Published notices lose their Edit/Publish buttons.
    await expect(row.locator("button:has(svg.lucide-pencil)")).toHaveCount(0);
    await expect(row.locator("button:has(svg.lucide-send)")).toHaveCount(0);
  });

  test("Create Notice as Draft (targeted at a specific role), then edit, publish, and view it", async ({ page }) => {
    const title = `E2E Draft Notice ${uniqueSuffix()}`;
    await page.goto("/admin/notices");
    await page.getByRole("button", { name: "Create Notice" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("Draft body, not yet published.");
    // ROLE_OPTIONS' label transform only uppercases already-uppercase text,
    // so the option label stays "FIELD EXECUTIVE", not title-cased.
    await page.locator("#audienceRole").selectOption("FIELD EXECUTIVE");
    // "Publish immediately" left unchecked.
    await page.getByRole("button", { name: "Save as Draft" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();
    await expect(row.getByText("FIELD EXECUTIVE", { exact: true })).toBeVisible();

    // View (read-only dialog).
    await row.locator("button:has(svg.lucide-eye)").click();
    await expect(page.getByText("Draft body, not yet published.")).toBeVisible();
    await expect(page.getByText("Draft — not yet published")).toBeVisible();
    await page.keyboard.press("Escape");

    // Edit is available on an unpublished draft.
    await row.locator("button:has(svg.lucide-pencil)").click();
    const newBody = "Updated draft body via edit.";
    await page.getByLabel("Body").fill(newBody);
    await page.getByRole("button", { name: "Update" }).click();
    await expect(row).toBeVisible();

    // Publish.
    await row.locator("button:has(svg.lucide-send)").click();
    await expect(row.getByText("Published", { exact: true })).toBeVisible();
    await expect(row.locator("button:has(svg.lucide-pencil)")).toHaveCount(0);
  });

  test("Delete removes an unpublished draft after confirmation", async ({ page }) => {
    const title = `E2E Deletable Draft ${uniqueSuffix()}`;
    await page.goto("/admin/notices");
    await page.getByRole("button", { name: "Create Notice" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("This draft will be deleted.");
    await page.getByRole("button", { name: "Save as Draft" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await row.locator("button:has(svg.lucide-trash-2)").click();
    await expect(page.getByRole("heading", { name: "Delete Notice" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(row).toHaveCount(0);
  });

  test("a published notice appears in the topbar notification bell", async ({ page }) => {
    const title = `E2E Bell Notice ${uniqueSuffix()}`;
    await page.goto("/admin/notices");
    await page.getByRole("button", { name: "Create Notice" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("Shown in the bell dropdown.");
    await page.getByLabel("Publish immediately").check();
    await page.getByRole("button", { name: "Create & Publish" }).click();
    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();

    await page.locator("header").getByRole("button").filter({ has: page.locator("svg.lucide-bell") }).click();
    // Scoped to the dropdown panel — the table row behind it also has this
    // exact text and the overlay doesn't remove it from the page.
    const notificationsPanel = page.getByText("Notifications", { exact: true }).locator("../..");
    await expect(notificationsPanel.getByText(title, { exact: true })).toBeVisible();
  });
});
