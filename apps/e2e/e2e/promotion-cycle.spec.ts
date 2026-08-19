import { test, expect } from "@playwright/test";
import { createActiveMemberApi, newApiContext, staffLoginApi } from "./support/api";
import { AUTH_STATE, E2E_ADMIN, E2E_FIELD_EXECUTIVE, uniqueMobile, uniqueSuffix } from "./support/constants";

test.describe("promotion cycle", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("promote an ACTIVE member to Field Executive, then they log in and register a member directly", async ({
    page,
  }) => {
    const apiCtx = await newApiContext();
    const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
    const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
    const memberId = await createActiveMemberApi(
      apiCtx,
      { fullName: `Promotable Member ${uniqueSuffix()}`, mobile: uniqueMobile(), password: "PromotableMember123pw" },
      fe.accessToken,
      admin.accessToken,
    );
    await apiCtx.dispose();

    const newFeEmail = `e2e-promoted-${uniqueSuffix()}@example.com`;
    const newFePassword = "PromotedExec123pw";

    await page.goto(`/admin/members/${memberId}/profile`);
    const promoteButton = page.getByRole("button", { name: "Promote to Field Executive" });
    await expect(promoteButton).toBeVisible();
    await promoteButton.click();
    await page.getByLabel("Staff login email").fill(newFeEmail);
    await page.getByLabel("Temporary password").fill(newFePassword);
    await page.getByRole("button", { name: "Promote", exact: true }).click();
    await expect(page.getByRole("button", { name: "Promote to Field Executive" })).toHaveCount(0);

    // Re-fetching the profile confirms the promotion persisted, not just the
    // in-memory UI state from before the sheet closed.
    await page.reload();
    await expect(page.getByRole("button", { name: "Promote to Field Executive" })).toHaveCount(0);

    // The new Field Executive account can log into the staff panel...
    const newFeContext = await page.context().browser()!.newContext();
    const newFePage = await newFeContext.newPage();
    await newFePage.goto("/admin/login");
    await newFePage.getByLabel("Email").fill(newFeEmail);
    await newFePage.getByLabel("Password").fill(newFePassword);
    await newFePage.getByRole("button", { name: "Sign In" }).click();
    await newFePage.waitForURL("**/admin");
    await expect(newFePage.getByText("field executive", { exact: true }).first()).toBeVisible();

    // ...and register a new member directly, door-to-door, confirming full
    // Field Executive capability rather than just a login that goes nowhere.
    const registeredMobile = uniqueMobile();
    await newFePage.goto("/admin/members");
    await newFePage.getByRole("button", { name: "Add Member" }).click();
    await newFePage.getByLabel("Full name").fill(`Registered By Promoted FE ${uniqueSuffix()}`);
    await newFePage.getByLabel("Mobile number").fill(registeredMobile);
    await newFePage.getByRole("button", { name: "Create Draft" }).click();
    await newFePage.waitForURL(/\/admin\/members\/[^/]+\/wizard/);
    await expect(newFePage.getByText("Step 1 of 10")).toBeVisible();

    await newFeContext.close();
  });
});
