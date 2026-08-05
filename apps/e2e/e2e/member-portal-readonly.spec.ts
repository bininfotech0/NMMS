import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./support/constants";

test.describe("member portal — read-only views (shared ACTIVE member)", () => {
  test.use({ storageState: AUTH_STATE.member });

  test("Dashboard: referral link renders and Copy button works", async ({ page }) => {
    await page.goto("/member");
    await expect(page.getByText("Your referral link")).toBeVisible();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/join\?ref=/);
  });

  test("My Referrals: table renders with an empty-state message", async ({ page }) => {
    await page.goto("/member/referrals");
    await expect(page.getByText(/People you referred/)).toBeVisible();
  });

  test("Wallet: points balance and ledger render", async ({ page }) => {
    await page.goto("/member/wallet");
    await expect(page.getByText("Points balance", { exact: true })).toBeVisible();
    await expect(page.getByText("Points history", { exact: true })).toBeVisible();
  });

  test("Rewards: rank progress and rewards list render", async ({ page }) => {
    await page.goto("/member/rewards");
    await expect(page.getByText("Your progress", { exact: true })).toBeVisible();
    await expect(page.getByText("Rewards earned", { exact: true })).toBeVisible();
  });
});
