// Temporary manual-QA walkthrough (not part of the e2e suite) — deleted after use.
import { chromium } from "@playwright/test";
import path from "node:path";

const BASE = "http://localhost:5180";
const OUT = process.env.SHOTS;
const PHOTO = path.resolve("fixtures/photo.jpg");
const PDF = path.resolve("fixtures/document.pdf");
const ASHA_MOBILE = process.env.ASHA_MOBILE;
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
let n = 0;
const shot = async (name) => page.screenshot({ path: `${OUT}/s${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });

try {
  await page.goto(BASE + "/admin/login");
  await page.getByLabel("Email").fill("field.exec@example.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/admin");
  await page.getByText("To do today").waitFor();
  await shot("fe-home");

  // Register a new member via the dashboard button
  await page.getByRole("button", { name: "Register a new member" }).click();
  await page.waitForURL("**/admin/members?add=1");
  await page.getByLabel("Full name").fill("Ramu Oraon");
  await page.getByLabel("Mobile number").fill(`8${String(Date.now()).slice(-9)}`);
  await shot("fe-add-sheet");
  await page.getByRole("button", { name: "Create Draft" }).click();
  await page.waitForURL("**/wizard");
  await page.getByText("Step 1 of 4").waitFor();
  await shot("wiz-1");
  await page.locator("#planId").selectOption({ index: 1 });
  await page.getByLabel("First name").fill("Ramu");
  await page.getByLabel("Last name").fill("Oraon");
  await page.getByRole("button", { name: "Save & Continue" }).click();
  await page.getByText("Step 2 of 4").waitFor();
  await page.locator("#current-addressLine").fill("Village Kanke, Ranchi");
  await page.locator("#current-pincode").fill("834006");
  await page.getByLabel("Same as current address").check();
  await shot("wiz-2");
  for (const name of ["PHOTO", "AADHAAR_FRONT"]) {
    const slot = page.getByTestId(`document-slot-${name}`);
    await slot.locator('input[type="file"]').setInputFiles(PHOTO);
    await slot.getByRole("button", { name: "Replace" }).waitFor({ timeout: 15000 });
  }
  await page.getByRole("button", { name: "Save & Continue" }).click();
  await page.getByText("Step 3 of 4").waitFor();
  for (const l of [
    "I declare that the information provided is correct.",
    "I accept the organization's constitution.",
    "I accept the privacy policy.",
    "I accept the terms & conditions.",
  ]) await page.getByLabel(l).check();
  await page.getByRole("button", { name: "Save Draft" }).click();
  await shot("wiz-3");
  await page.getByRole("button", { name: "Submit Application" }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByText("Step 4 of 4").waitFor({ timeout: 15000 });
  await shot("wiz-4");

  // Collect Asha's fee from "Waiting for payment" (she self-registered, so an admin can see her; FE may not)
  await page.goto(BASE + "/admin/applications");
  await page.waitForTimeout(1500);
  await shot("fe-waiting");
} catch (e) {
  console.log("FAILED", e.message);
  await shot("failure");
} finally {
  await browser.close();
}

// Admin part
const b2 = await chromium.launch();
const admin = await b2.newPage({ viewport: { width: 390, height: 844 } });
admin.on("pageerror", (e) => errors.push("PAGEERROR(admin) " + e.message));
admin.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
const ashot = async (name) => admin.screenshot({ path: `${OUT}/a${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });
try {
  await admin.goto(BASE + "/admin/login");
  await admin.getByLabel("Email").fill("admin@example.com");
  await admin.getByLabel("Password").fill("ChangeMe123!");
  await admin.getByRole("button", { name: "Sign In" }).click();
  await admin.waitForURL("**/admin");
  await admin.getByText("To do today").waitFor();
  await ashot("admin-home");
  await admin.goto(BASE + "/admin/applications");
  const row = admin.getByRole("row", { name: /Asha Kumari/ });
  await row.waitFor({ timeout: 10000 });
  await ashot("admin-waiting");
  await row.getByRole("button", { name: "Collect payment" }).click();
  await admin.getByText("Collect the fee").waitFor({ timeout: 10000 });
  await ashot("collect-sheet");
  await admin.getByRole("button", { name: "Money received — save" }).click();
  await admin.waitForTimeout(2000);
  await ashot("after-collect");
  await admin.goto(BASE + "/admin/members");
  await admin.waitForTimeout(1500);
  await ashot("members-list");
  await admin.getByRole("row", { name: /Asha Kumari/ }).click();
  await admin.waitForURL("**/profile");
  await admin.getByRole("button", { name: "More actions" }).click();
  await ashot("member-more-actions");
  await admin.keyboard.press("Escape");
  await admin.goto(BASE + "/admin/settings");
  await admin.getByRole("button", { name: "Online payments & messages" }).click();
  await admin.waitForTimeout(1000);
  await ashot("settings-integrations");
  await admin.goto(BASE + "/admin/audit-logs");
  await admin.waitForTimeout(1500);
  await ashot("activity-history");
  await admin.goto(BASE + "/admin/withdrawals");
  await admin.waitForTimeout(1500);
  await ashot("withdrawals");
} catch (e) {
  console.log("FAILED(admin)", e.message);
  await ashot("failure");
} finally {
  console.log("ERRORS", JSON.stringify(errors, null, 1));
  await b2.close();
}
