// Temporary manual-QA walkthrough — deleted after use.
import { chromium } from "@playwright/test";
const BASE = "http://localhost:5180";
const OUT = process.env.SHOTS;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(BASE + "/admin/login");
await p.getByLabel("Email").fill("admin@example.com");
await p.getByLabel("Password").fill("ChangeMe123!");
await p.getByRole("button", { name: "Sign In" }).click();
await p.waitForURL("**/admin");
for (const [path, name] of [["/admin/donations", "donations"], ["/admin/audit-logs", "activity"], ["/admin/members/" + process.env.RAMU_ID + "/wizard", "wizard"]]) {
  await p.goto(BASE + path);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/z-${name}.png`, fullPage: false });
}
await browser.close();
