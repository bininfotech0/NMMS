import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDraftMemberApi, newApiContext, staffLoginApi } from "./support/api";
import { AUTH_STATE, E2E_ADMIN, uniqueMobile, uniqueSuffix } from "./support/constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.join(__dirname, "..", "fixtures", "sample.pdf");
const INVALID = path.join(__dirname, "..", "fixtures", "invalid.txt");

test.describe("documents — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("upload a document, filter by search/type, download, then delete", async ({ page }) => {
    const name = `Documents Member ${uniqueSuffix()}`;
    const mobile = uniqueMobile();
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    await createDraftMemberApi(apiCtx, admin.accessToken, { fullName: name, mobile });
    await apiCtx.dispose();

    await page.goto("/admin/documents");
    await page.getByRole("button", { name: "Upload Document" }).click();
    await page.locator("#member").selectOption({ label: `${name} (${mobile})` });
    await page.locator("#doc-type").selectOption("Address Proof");
    await page.locator("#file").setInputFiles(PDF);
    await page.getByRole("button", { name: "Upload" }).click();
    // "Upload Document" is also the trigger button's own label, so checking
    // it's gone would false-positive against that — the row appearing is a
    // stronger, more direct signal the upload actually succeeded. Search by
    // this test's own unique name right away — the unfiltered list is
    // sorted oldest-first and accumulates rows across every test/run against
    // this shared dev database, so a brand-new upload can land past the
    // first page long before the list itself is what's under test here.
    const row = page.getByRole("row", { name: new RegExp(name) });
    await page.getByPlaceholder("Search by member or file name...").fill(name);
    await expect(row).toBeVisible();

    // Search filter.
    await page.getByPlaceholder("Search by member or file name...").fill("zzz-no-such-document-zzz");
    await expect(row).toHaveCount(0);
    await page.getByPlaceholder("Search by member or file name...").fill(name);
    await expect(row).toBeVisible();

    // Type filter (the sheet is closed, so this is the only <select> on the
    // page) — Address Proof should keep it, Photo should hide it.
    const typeFilter = page.locator("select");
    await typeFilter.selectOption("Address Proof");
    await expect(row).toBeVisible();
    await typeFilter.selectOption("Photo");
    await expect(row).toHaveCount(0);
    await typeFilter.selectOption("all");

    // Download.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      row.locator("button:has(svg.lucide-download)").click(),
    ]);
    expect(download.suggestedFilename()).toBeTruthy();

    // Delete.
    await row.locator("button:has(svg.lucide-trash-2)").click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(row).toHaveCount(0);
  });

  test("uploading an invalid file type is rejected with a clear error", async ({ page }) => {
    // Avoids the word "invalid" in the name — it would otherwise collide
    // with the rejection error text under a case-insensitive substring match.
    const name = `Wrong Filetype Member ${uniqueSuffix()}`;
    const mobile = uniqueMobile();
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    await createDraftMemberApi(apiCtx, admin.accessToken, { fullName: name, mobile });
    await apiCtx.dispose();

    await page.goto("/admin/documents");
    await page.getByRole("button", { name: "Upload Document" }).click();
    await page.locator("#member").selectOption({ label: `${name} (${mobile})` });
    await page.locator("#file").setInputFiles(INVALID);
    await page.getByRole("button", { name: "Upload" }).click();
    // Scoped to the sheet's own inline error text — a whole-page text search
    // for "invalid" would also match unrelated member names accumulated in
    // the #member dropdown from earlier runs of this same test.
    await expect(page.locator("p.text-destructive")).toContainText(/unsupported|invalid|not allowed/i);
    // The sheet must still be open — the upload was rejected, not silently dropped.
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
  });
});
