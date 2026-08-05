import { defineConfig, devices } from "@playwright/test";

// A single default project, unauthenticated by default (matches the old
// "no-auth" project). Every spec file pins whichever role(s) it needs via
// `test.use({ storageState: ".auth/<role>.json" })` at file or describe-block
// scope (see e2e/support/constants.ts for the AUTH_STATE path constants) —
// this makes each file correct no matter how the suite is invoked, and each
// test runs exactly once instead of once per role-project.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
  },
});
