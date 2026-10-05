// Temporary manual-QA walkthrough (not part of the e2e suite) — deleted after use.
import { chromium } from "@playwright/test";
import path from "node:path";

const BASE = "http://localhost:5180";
const OUT = process.env.SHOTS;
const PHOTO = path.resolve("fixtures/photo.jpg");
const mobile = `9${String(Date.now()).slice(-9)}`;
const aadhaar = String(Date.now()).slice(-12).padStart(12, "4");
const consoleErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + e.message));
let n = 0;
const shot = async (name) => page.screenshot({ path: `${OUT}/m${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });

try {
  await page.goto(BASE + "/");
  await shot("home");
  await page.getByRole("link", { name: "Become a member" }).click();
  await page.waitForURL("**/join");
  await page.getByLabel("Full name").fill("Asha Kumari");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Aadhaar number").fill(aadhaar);
  await page.getByLabel("Create a password").fill("Asha12345");
  await shot("join-filled");
  await page.getByRole("button", { name: "Join now" }).click();
  await page.waitForURL("**/member", { timeout: 20000 });
  await page.getByText("Choose your membership plan").waitFor();
  await shot("step1-plan");
  await page.getByRole("button", { name: /Silver Membership/ }).click();
  await page.getByText("Add your details").waitFor();
  await shot("step2-empty");
  await page.locator("#join-addressLine").fill("Ward 4, Near Shiv Mandir, Ranchi");
  await page.locator("#join-pincode").fill("834001");
  const files = page.locator('input[type="file"]');
  await files.nth(0).setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Change photo" }).waitFor({ timeout: 15000 });
  await files.nth(1).setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Add another ID" }).waitFor({ timeout: 15000 });
  for (const label of [
    "The information I have given is true and correct",
    "I accept the organization's rules (constitution)",
    "I accept the privacy policy",
    "I accept the terms & conditions",
  ]) {
    await page.getByText(label, { exact: true }).locator('input[type="checkbox"]').check();
  }
  await shot("step2-filled");
  await page.getByRole("button", { name: "Save and go to payment" }).click();
  await page.getByText("Pay your membership fee").waitFor({ timeout: 15000 });
  await shot("step3-pay");
  await page.getByRole("button", { name: "More" }).click().catch(() => {});
  await shot("mobile-more-menu");
  console.log("MOBILE", mobile);
} catch (e) {
  console.log("FAILED", e.message);
  await shot("failure");
} finally {
  console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors, null, 1));
  await browser.close();
}
