import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./support/constants";

// Same suite of checks run once per staff role (super-admin/admin/field-executive)
// via a describe-block factory — each block pins its own storageState with
// test.use(), so this works correctly regardless of how the suite is invoked.
const ROLES: Array<{
  label: string;
  storageState: string;
  canManageUsers: boolean;
  isSuperAdmin: boolean;
  canViewAuditLogs: boolean;
}> = [
  { label: "super-admin", storageState: AUTH_STATE.superAdmin, canManageUsers: true, isSuperAdmin: true, canViewAuditLogs: true },
  { label: "admin", storageState: AUTH_STATE.admin, canManageUsers: true, isSuperAdmin: false, canViewAuditLogs: true },
  { label: "field-executive", storageState: AUTH_STATE.fieldExecutive, canManageUsers: false, isSuperAdmin: false, canViewAuditLogs: false },
];

for (const role of ROLES) {
  test.describe(`dashboard & nav — ${role.label}`, () => {
    test.use({ storageState: role.storageState });

    test.describe("dashboard quick actions", () => {
      test("Review Applications navigates to the Applications queue", async ({ page }) => {
        await page.goto("/admin");
        await page.getByRole("button", { name: "Review Applications" }).click();
        await page.waitForURL("**/admin/applications");
      });

      test("Record Payment navigates to Payments", async ({ page }) => {
        await page.goto("/admin");
        await page.getByRole("button", { name: "Record Payment" }).click();
        await page.waitForURL("**/admin/payments");
      });

      test("Create Notice navigates to Notices", async ({ page }) => {
        await page.goto("/admin");
        await page.getByRole("button", { name: "Create Notice" }).click();
        await page.waitForURL("**/admin/notices");
      });

      test("New Registration — documents actual behavior of the /admin/members/new/wizard link", async ({ page }) => {
        await page.goto("/admin");
        await page.getByRole("button", { name: "New Registration" }).click();
        // The route table only defines /admin/members/:id/wizard — "new" is treated
        // as the :id param. This test records what actually happens rather than
        // assuming it's broken or working; a real regression here should change
        // the URL/error assertion below, which is the point of writing it down.
        await page.waitForURL("**/admin/members/new/wizard");
        // No hard assertion on the resulting page content — known gap, see plan.
      });
    });

    test.describe("topbar", () => {
      test("global search filters the Members list", async ({ page }) => {
        await page.goto("/admin");
        await page.getByPlaceholder("Search members, ID, or mobile...").fill("zzz-no-such-member-zzz");
        await page.getByPlaceholder("Search members, ID, or mobile...").press("Enter");
        await page.waitForURL(/\/admin\/members\?search=/);
      });

      test("notification bell opens and 'View all notices' navigates to Notices", async ({ page }) => {
        await page.goto("/admin");
        // Scoped to <header> — the "Create Notice" dashboard quick action also
        // happens to use the Bell icon, so an unscoped lookup matches both.
        await page.locator("header").getByRole("button").filter({ has: page.locator("svg.lucide-bell") }).click();
        await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
        const viewAll = page.getByRole("button", { name: "View all notices" });
        if (await viewAll.count()) {
          await viewAll.click();
          await page.waitForURL("**/admin/notices");
        } else {
          await expect(page.getByText("No new notifications")).toBeVisible();
        }
      });

      test("user avatar dropdown offers Dashboard/Settings/Logout", async ({ page }) => {
        await page.goto("/admin");
        const userMenuTrigger = page.locator("header button").filter({ has: page.locator('[data-slot="avatar"]') });
        await userMenuTrigger.click();
        await expect(page.getByRole("menuitem", { name: "Dashboard" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Logout" })).toBeVisible();
        await page.keyboard.press("Escape");
      });
    });

    test.describe("sidebar", () => {
      const NAV_LINKS: Array<[string, string]> = [
        ["Dashboard", "/admin"],
        ["Members", "/admin/members"],
        ["Applications", "/admin/applications"],
        ["Membership Plans", "/admin/membership"],
        ["Referral Rewards", "/admin/referral-rewards"],
        ["Payments", "/admin/payments"],
        ["Events", "/admin/events"],
        ["Documents", "/admin/documents"],
        ["Notices", "/admin/notices"],
        ["Reports & Analytics", "/admin/reports"],
        ["Settings", "/admin/settings"],
      ];

      for (const [label, path] of NAV_LINKS) {
        test(`nav link "${label}" navigates to ${path}`, async ({ page }) => {
          await page.goto("/admin");
          // "Applications" carries a live pending-count badge (e.g.
          // "Applications 7") that grows as the shared dev DB accumulates
          // data across runs — match it as a whole-word prefix instead of
          // requiring an exact "Applications" with no badge at all. No other
          // label in this list shares "Applications" as a prefix, so this
          // stays unambiguous.
          const name = label === "Applications" ? new RegExp(`^${label}(\\s|$)`) : label;
          await page.getByRole("link", { name, exact: label !== "Applications" }).click();
          await page.waitForURL(new RegExp(path.replace(/\//g, "\\/") + "$"));
        });
      }

      test("Users link visibility matches role (ADMIN/SUPER_ADMIN only)", async ({ page }) => {
        await page.goto("/admin");
        const usersLink = page.getByRole("link", { name: "Users", exact: true });
        if (role.canManageUsers) {
          await expect(usersLink).toBeVisible();
        } else {
          await expect(usersLink).toHaveCount(0);
        }
      });

      test("Audit Logs link visibility matches role (ADMIN and SUPER_ADMIN)", async ({ page }) => {
        await page.goto("/admin");
        const auditLink = page.getByRole("link", { name: "Audit Logs", exact: true });
        if (role.canViewAuditLogs) {
          await expect(auditLink).toBeVisible();
        } else {
          await expect(auditLink).toHaveCount(0);
        }
      });

      test("section headers collapse and expand", async ({ page }) => {
        await page.goto("/admin");
        const membersLink = page.getByRole("link", { name: "Members", exact: true });
        await expect(membersLink).toBeVisible();
        await page.getByRole("button", { name: "Membership" }).click();
        await expect(membersLink).toBeHidden();
        await page.getByRole("button", { name: "Membership" }).click();
        await expect(membersLink).toBeVisible();
      });
    });

    test.describe("mobile nav", () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test("bottom bar renders all 6 items and navigates", async ({ page }) => {
        await page.goto("/admin");
        const nav = page.locator("nav.fixed.bottom-0");
        await expect(nav).toBeVisible();
        for (const label of ["Home", "Members", "Applications", "Payments", "Events", "More"]) {
          await expect(nav.getByText(label)).toBeVisible();
        }
        await nav.getByText("Members").click();
        await page.waitForURL("**/admin/members");
      });
    });
  });
}
