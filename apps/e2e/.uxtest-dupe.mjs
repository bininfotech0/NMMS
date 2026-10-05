// Temporary manual-QA check — deleted after use.
import { chromium } from "@playwright/test";
const BASE = "http://localhost:5180", OUT = process.env.SHOTS;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(BASE + "/admin/login");
await p.getByLabel("Email").fill("field.exec@example.com");
await p.getByLabel("Password").fill("ChangeMe123!");
await p.getByRole("button", { name: "Sign In" }).click();
await p.waitForURL("**/admin");
await p.goto(BASE + "/admin/members?add=1");
await p.getByLabel("Full name").fill("Copy Of Asha");
await p.getByLabel("Mobile number").fill("9205078589");
await p.getByLabel("Mobile number").blur();
await p.getByText(/already registered to/i).waitFor({ timeout: 10000 });
console.log("Create disabled:", await p.getByRole("button", { name: "Create Draft" }).isDisabled());
await p.screenshot({ path: `${OUT}/dupe-mobile.png` });
// Server refuses even if the UI is bypassed
const res = await p.evaluate(async () => {
  const token = JSON.parse(localStorage.getItem("auth-storage") || "{}")?.state?.accessToken;
  const r = await fetch("/api/v1/members", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: "include", body: JSON.stringify({ fullName: "Copy Of Asha", mobile: "9205078589" }) });
  return { status: r.status, body: await r.text() };
});
console.log("API:", res.status, res.body.slice(0, 200));
await browser.close();
