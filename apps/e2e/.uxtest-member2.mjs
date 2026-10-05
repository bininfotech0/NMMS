// Temporary manual-QA walkthrough (not part of the e2e suite) — deleted after use.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5180";
const OUT = process.env.SHOTS;
const MOBILE = process.env.ASHA_MOBILE;
const PHASE = process.env.PHASE ?? "active";
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
let n = 0;
const shot = async (name) =>
  page.screenshot({ path: `${OUT}/${PHASE[0]}${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });

async function login() {
  await page.goto(BASE + "/login");
  await page.getByLabel("Mobile number").fill(MOBILE);
  await page.getByLabel("Password").fill("Asha12345");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/member");
}

try {
  if (PHASE === "forgot") {
    await page.goto(BASE + "/login");
    await shot("login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.waitForURL("**/forgot-password");
    await page.waitForTimeout(1200);
    await shot("forgot");
  } else if (PHASE === "expired") {
    await login();
    await page.waitForTimeout(1500);
    await shot("expired-home");
  } else {
    await login();
    await page.getByText("My membership", { exact: true }).waitFor();
    await shot("home");
    await page.getByRole("link", { name: "View my membership card" }).click();
    await page.waitForURL("**/member/card");
    await page.waitForTimeout(1500);
    await shot("card");
    for (const [path, name] of [
      ["/member/kyc", "bank-details"],
      ["/member/wallet", "wallet"],
      ["/member/notices", "notices"],
      ["/member/payments", "payments"],
      ["/member/profile", "profile"],
      ["/member/events", "events"],
    ]) {
      await page.goto(BASE + path);
      await page.waitForTimeout(1500);
      await shot(name);
    }
    await page.goto(BASE + "/member/donations");
    const toggle = page.getByRole("button", { name: "Already gave cash, UPI or a cheque? Tell us here" });
    const mode = page.getByLabel("How did you send it?");
    await toggle.or(mode).first().waitFor();
    if (await toggle.isVisible()) await toggle.click();
    await page.getByLabel("Amount").fill("250");
    await page.getByRole("button", { name: "Tell us about my donation" }).click();
    await page.getByText("Being checked").waitFor({ timeout: 10000 });
    await shot("donation-pending");
    // More sheet on mobile
    await page.goto(BASE + "/member");
    await page.getByRole("button", { name: "More" }).click();
    await page.waitForTimeout(500);
    await shot("more");
  }
} catch (e) {
  console.log("FAILED", e.message);
  await shot("failure");
} finally {
  console.log("ERRORS", JSON.stringify(errors, null, 1));
  await browser.close();
}
