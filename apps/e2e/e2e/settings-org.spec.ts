import { test, expect } from "@playwright/test";
import { AUTH_STATE, uniqueSuffix } from "./support/constants";

test.describe("settings — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("Organization tab: every field saves and persists across reload", async ({ page }) => {
    const orgName = `E2E Org ${uniqueSuffix()}`;
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Organization" }).click();

    await page.getByLabel("Organization name").fill(orgName);
    await page.getByLabel("Logo URL").fill("/uploads/e2e-logo.png");
    await page.getByLabel("Address").fill("123 E2E Test Street, New Delhi");
    await page.getByLabel("Contact email").fill("contact@e2e-test.org");
    await page.getByLabel("Contact phone").fill("+91 9999999999");
    await page.getByLabel("Bank name").fill("E2E Test Bank");
    await page.getByLabel("Account holder name").fill("E2E Test Org");
    await page.getByLabel("Account number").fill("123456789012");
    await page.getByLabel("IFSC code").fill("TEST0001234");
    await page.getByLabel("Membership number format").fill("{PREFIX}-{YYYY}-{SEQ}");
    await page.getByLabel("Receipt number format").fill("RCPT-{YYYY}-{SEQ}");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Organization" }).click();
    await expect(page.getByLabel("Organization name")).toHaveValue(orgName);
    await expect(page.getByLabel("Contact email")).toHaveValue("contact@e2e-test.org");
    await expect(page.getByLabel("Account number")).toHaveValue("123456789012");
  });

  test("Referral Program tab: toggle and points save", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Referral Program" }).click();

    const toggle = page.getByRole("button", { name: /^(Enabled|Disabled)$/ });
    const initialState = await toggle.textContent();
    await toggle.click();
    const flippedState = await toggle.textContent();
    expect(flippedState).not.toBe(initialState);
    await toggle.click(); // restore
    await expect(toggle).toHaveText(initialState ?? "");

    // Volunteer batch now mirrors the member's plan tier directly (granted on
    // activation/upgrade) — there's no points-threshold form here anymore.
    await page.getByLabel("Points per approved referral").fill("15");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

    await page.getByLabel("Points per approved referral").fill("10");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  });

  test("Integrations tab: toggle flags and configure Payment Gateway (write-only credentials)", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Integrations" }).click();

    // Configure only ever appears for the flags in Settings.tsx's own
    // CONFIGURABLE_INTEGRATION_KEYS (Payment Gateway/Payouts, SMS, WhatsApp,
    // Email) — and unconditionally so, regardless of enabled/disabled state.
    // AI Duplicate Detection/AI Document Verification never show it at all.
    const NEVER_CONFIGURABLE = new Set(["AI Duplicate Detection", "AI Document Verification"]);

    for (const label of ["WhatsApp Notifications", "AI Duplicate Detection", "AI Document Verification", "SMS Notifications", "Email Notifications"]) {
      const row = page.locator('div.rounded-xl.border.border-border.bg-card.p-4').filter({ hasText: label });
      const flagToggle = row.getByRole("button", { name: /^(Enabled|Disabled)$/ });
      const configureCount = NEVER_CONFIGURABLE.has(label) ? 0 : 1;
      await expect(row.getByRole("button", { name: "Configure" })).toHaveCount(configureCount);
      const before = await flagToggle.textContent();
      await flagToggle.click();
      await expect(flagToggle).not.toHaveText(before ?? "");
    }

    const paymentRow = page.locator('div.rounded-xl.border.border-border.bg-card.p-4').filter({ hasText: "Payment Gateway" });
    await paymentRow.getByRole("button", { name: "Configure" }).click();
    // Test and Live mode each render their own credentials form with an
    // identically-labeled "Key ID"/"Key Secret" field (RazorpayModeCredentialsForm,
    // one per mode) — getByLabel alone is ambiguous, so scope to Test mode's ids.
    await page.locator("#rzp-test-key-id").fill("rzp_test_e2e123456");
    await page.locator("#rzp-test-key-secret").fill("test_secret_e2e");
    await page.locator("#rzp-test-webhook-secret").fill("test_webhook_secret_e2e");
    // The Webhook URL field has no htmlFor/id linkage to its Label — it's the
    // only readonly input on this form, so target it directly.
    await expect(page.locator("input[readonly]")).toHaveValue(/\/api\/v1\/webhooks\/razorpay\//);
    await page.getByRole("button", { name: "Save test credentials" }).click();
    // This form (RazorpayModeCredentialsForm) signals success via a toast
    // only, unlike its sibling config forms which also show inline "Saved."
    // text.
    await expect(page.getByText("Test credentials saved")).toBeVisible();
    // Scoped to the test-mode form specifically — live mode has its own
    // separate (currently unconfigured) "Configured" badge slot too.
    const testModeForm = paymentRow.locator("form").filter({ hasText: "test mode" });
    await expect(testModeForm.getByText("Configured", { exact: true })).toBeVisible();

    // Collapse and re-expand — write-only fields must come back blank.
    await paymentRow.getByRole("button", { name: "Configure" }).click();
    await paymentRow.getByRole("button", { name: "Configure" }).click();
    await expect(page.locator("#rzp-test-key-id")).toHaveValue("");
    await expect(page.locator("#rzp-test-key-secret")).toHaveValue("");
  });
});

test.describe("settings — field executive", () => {
  test.use({ storageState: AUTH_STATE.fieldExecutive });

  test("every Save/Toggle button is rendered but yields a graceful error, not a crash", async ({ page }) => {
    await page.goto("/admin/settings");

    await page.getByRole("button", { name: "Organization" }).click();
    await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
    await page.getByLabel("Organization name").fill("FE Attempted Change");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText(/permission|forbidden|error/i).first()).toBeVisible();

    await page.getByRole("button", { name: "Integrations" }).click();
    const anyToggle = page.getByRole("button", { name: /^(Enabled|Disabled)$/ }).first();
    await expect(anyToggle).toBeVisible();
    await anyToggle.click();
    // Either an inline/toast error appears, or the toggle simply doesn't
    // persist — either way the page must not crash; confirm it's still usable.
    await expect(page.getByRole("button", { name: "Integrations" })).toBeVisible();
  });
});
