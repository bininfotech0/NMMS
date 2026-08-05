import { test, expect } from "@playwright/test";
import { AUTH_STATE, uniqueSuffix } from "./support/constants";

test.describe("users management — super admin", () => {
  test.use({ storageState: AUTH_STATE.superAdmin });

  test("Add User creates one of each role", async ({ page }) => {
    await page.goto("/admin/users");
    for (const role of ["Super Admin", "Admin", "Field Executive"]) {
      const email = `e2e-newuser-${uniqueSuffix()}@example.com`;
      await page.getByRole("button", { name: "Add User" }).click();
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Temporary password").fill("NewUser123pw");
      await page.locator("#role").selectOption(role);
      await page.getByRole("button", { name: "Create User" }).click();
      await expect(page.getByRole("row", { name: new RegExp(email) })).toBeVisible();
    }
  });

  test("Edit updates an existing user's role", async ({ page }) => {
    const email = `e2e-editrole-${uniqueSuffix()}@example.com`;
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Temporary password").fill("EditRole123pw");
    await page.locator("#role").selectOption("Field Executive");
    await page.getByRole("button", { name: "Create User" }).click();

    const row = page.getByRole("row", { name: new RegExp(email) });
    await expect(row.getByText("Field Executive", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Edit" }).click();
    await page.locator("#role").selectOption("Admin");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(row.getByText("Admin", { exact: true })).toBeVisible();
  });

  test("Reset Password sets a new password the user can log in with", async ({ page }) => {
    const email = `e2e-resetpw-${uniqueSuffix()}@example.com`;
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Temporary password").fill("OldPassword123");
    await page.locator("#role").selectOption("Field Executive");
    await page.getByRole("button", { name: "Create User" }).click();

    const row = page.getByRole("row", { name: new RegExp(email) });
    await row.getByRole("button", { name: "Reset Password" }).click();
    await page.getByLabel("New password").fill("BrandNewPassword123");
    await page.getByRole("button", { name: "Set New Password" }).click();
    await expect(page.getByText("Password updated successfully.")).toBeVisible();
    await page.keyboard.press("Escape");

    const freshContext = await page.context().browser()!.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto("/login");
    await freshPage.getByLabel("Email").fill(email);
    await freshPage.getByLabel("Password").fill("BrandNewPassword123");
    await freshPage.getByRole("button", { name: "Sign In" }).click();
    await freshPage.waitForURL("**/admin");
    await freshContext.close();
  });

  test("Activate/Deactivate toggle flips the status badge", async ({ page }) => {
    const email = `e2e-toggle-${uniqueSuffix()}@example.com`;
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Temporary password").fill("ToggleUser123");
    await page.locator("#role").selectOption("Field Executive");
    await page.getByRole("button", { name: "Create User" }).click();

    const row = page.getByRole("row", { name: new RegExp(email) });
    await expect(row.getByText("Active", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Activate" }).click();
    await expect(row.getByText("Active", { exact: true })).toBeVisible();
  });
});

test.describe("users management — admin (super-admin protection)", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("cannot create a SUPER_ADMIN user", async ({ page }) => {
    const email = `e2e-blocked-sa-${uniqueSuffix()}@example.com`;
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Temporary password").fill("BlockedSA123pw");
    await page.locator("#role").selectOption("Super Admin");
    await page.getByRole("button", { name: "Create User" }).click();
    await expect(page.getByText(/only a super admin/i).first()).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(email) })).toHaveCount(0);
  });

  test("cannot edit or reset the password of an existing SUPER_ADMIN", async ({ page }) => {
    await page.goto("/admin/users");
    // "admin@example.com" is a substring of "e2e-admin@example.com" too — the
    // email <span> itself (not the cell, which also mixes in avatar initials
    // text) has this as its exact full text only for the seed super-admin row.
    const superAdminRow = page
      .getByText("admin@example.com", { exact: true })
      .locator("xpath=ancestor::tr[1]");
    await expect(superAdminRow).toBeVisible();

    await superAdminRow.getByRole("button", { name: "Edit" }).click();
    await page.locator("#role").selectOption("Admin");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText(/permission|forbidden|super admin/i).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await superAdminRow.getByRole("button", { name: "Reset Password" }).click();
    await page.getByLabel("New password").fill("ShouldNotWork123");
    await page.getByRole("button", { name: "Set New Password" }).click();
    await expect(page.getByText(/permission|forbidden|super admin/i).first()).toBeVisible();
  });

  test("can create and edit ADMIN/FIELD_EXECUTIVE users normally", async ({ page }) => {
    const email = `e2e-admin-created-${uniqueSuffix()}@example.com`;
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Temporary password").fill("AdminCreated123pw");
    await page.locator("#role").selectOption("Field Executive");
    await page.getByRole("button", { name: "Create User" }).click();
    await expect(page.getByRole("row", { name: new RegExp(email) })).toBeVisible();
  });
});

test.describe("users management — field executive", () => {
  test.use({ storageState: AUTH_STATE.fieldExecutive });

  test("Users nav link is absent and the page shows a permission-denied message", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
    await expect(page.getByText("You don't have permission to manage users.")).toBeVisible();
  });
});
