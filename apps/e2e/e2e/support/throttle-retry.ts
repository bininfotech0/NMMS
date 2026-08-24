import type { Page } from "@playwright/test";

// Browser-driven form submissions (staff/member login, self-registration)
// hit the same IP-keyed, per-route throttled endpoints (/api/v1/auth/login,
// /api/v1/public/member-auth/login, /api/v1/public/member-auth/register —
// 8/60s each, see api.ts's postWithThrottleRetry for the full explanation of
// why this is a real, correctly-working server-side control rather than a
// bug) as api.ts's own helpers — but fire the request from inside the page
// itself, so that Node-side retry logic never sees them. Route-intercepts
// the same three paths at the Playwright page layer and applies the
// identical "retry once after x-ratelimit-reset seconds" behavior, so a
// UI-driven login/register that collides with another spec file's recent
// calls degrades to "slightly slower" instead of "fails the test".
export async function armThrottleRetry(page: Page): Promise<void> {
  await page.route(/\/api\/v1\/(auth\/login|public\/member-auth\/(login|register))$/, async (route) => {
    const response = await route.fetch();
    if (response.status() !== 429) {
      await route.fulfill({ response });
      return;
    }
    const resetHeader = response.headers()["x-ratelimit-reset"];
    const resetSeconds = resetHeader ? Number(resetHeader) : 60;
    const waitMs = (Number.isFinite(resetSeconds) ? resetSeconds : 60) * 1000 + 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const retried = await route.fetch();
    await route.fulfill({ response: retried });
  });
}
