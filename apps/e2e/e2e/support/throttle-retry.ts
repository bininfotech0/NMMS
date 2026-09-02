import { test, type Page } from "@playwright/test";
import { THROTTLE_RETRY_TEST_TIMEOUT_MS } from "./constants";

// The server's IP-keyed throttle window is 60s, so a caught 429 can wait up
// to ~61s (see waitMs below) before retrying. Playwright's suite-wide default
// test timeout is 45s (playwright.config.ts) — comfortably enough for a
// normal run, but not enough to survive that worst-case wait on top of the
// test's own steps. Extend just the current test's timeout so an armed test
// degrades to "slightly slower" instead of "times out" when it genuinely
// collides with the throttle, rather than raising the suite-wide default
// (which would also mask a real hang in the ~99% of tests that never touch
// this path). Only ever upward, via Math.max — test.setTimeout() replaces
// rather than adds to the existing value, so a test that already set a
// longer timeout for its own reasons (test.slow(), or its own
// test.setTimeout()) must keep it.

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
    // Only extend when we're actually about to take the slow path — tests
    // that never collide with the throttle keep the suite's normal 45s cap.
    // test.setTimeout() only raises the *overall* test budget, though — it
    // does nothing for the page's own default navigation timeout, which is a
    // separate, shorter clock (Playwright's built-in 30s here, since neither
    // playwright.config.ts nor any spec overrides it). A page.waitForURL()
    // immediately following the click this route just intercepted would
    // still time out on its own well before this route's ~61s wait below
    // finishes, even though the test itself now has budget to spare — so
    // extend the page's default navigation timeout too, retroactively
    // covering every waitForURL() call for the rest of this test with no
    // per-call-site changes needed. (expect()'s own default timeout is a
    // third, independent clock — playwright.config.ts pins it explicitly, so
    // it can only be raised per-assertion, not from here.)
    test.setTimeout(Math.max(test.info().timeout, THROTTLE_RETRY_TEST_TIMEOUT_MS));
    page.setDefaultNavigationTimeout(THROTTLE_RETRY_TEST_TIMEOUT_MS);
    const resetHeader = response.headers()["x-ratelimit-reset"];
    const resetSeconds = resetHeader ? Number(resetHeader) : 60;
    const waitMs = (Number.isFinite(resetSeconds) ? resetSeconds : 60) * 1000 + 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const retried = await route.fetch();
    await route.fulfill({ response: retried });
  });
}
