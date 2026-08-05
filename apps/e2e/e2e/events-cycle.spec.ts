import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createActiveMemberApi, newApiContext, staffLoginApi } from "./support/api";
import { AUTH_STATE, E2E_ADMIN, E2E_FIELD_EXECUTIVE, uniqueMobile, uniqueSuffix } from "./support/constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO = path.join(__dirname, "..", "fixtures", "photo.jpg");

async function createMemberSession(browser: import("@playwright/test").Browser, fullName: string) {
  const apiCtx = await newApiContext();
  const admin = await staffLoginApi(apiCtx, E2E_ADMIN.email, E2E_ADMIN.password);
  const fe = await staffLoginApi(apiCtx, E2E_FIELD_EXECUTIVE.email, E2E_FIELD_EXECUTIVE.password);
  const mobile = uniqueMobile();
  const password = "EventsCycleMember123pw";
  await createActiveMemberApi(apiCtx, { fullName, mobile, password }, fe.accessToken, admin.accessToken);
  await apiCtx.dispose();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/member/login");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/member");
  return { context, page };
}

test.describe("events — admin", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("Create Event with a completion target appears in the list", async ({ page }) => {
    const title = `Tree Plantation ${uniqueSuffix()}`;
    await page.goto("/admin/events");
    await page.getByRole("button", { name: "Create Event" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description", { exact: true }).fill("Plant saplings across the district");
    await page.getByLabel("Location").fill("Community Park");
    await page.getByLabel("Starts at").fill("2027-01-15T09:00");
    await page.getByLabel("Target description").fill("Plant 100 saplings");
    await page.getByLabel("Target quantity").fill("100");
    await page.getByLabel("Points reward").fill("50");
    await page.getByRole("button", { name: "Create Event" }).click();
    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  });

  test("staff-side direct registration and attendance toggle", async ({ page }) => {
    const title = `Blood Donation ${uniqueSuffix()}`;
    await page.goto("/admin/events");
    await page.getByRole("button", { name: "Create Event" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Starts at").fill("2027-02-01T09:00");
    await page.getByRole("button", { name: "Create Event" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.locator("#add-member").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("No one registered yet.")).toHaveCount(0);

    const attendanceButton = page.getByRole("button", { name: "Mark present" });
    await attendanceButton.click();
    await expect(page.getByRole("button", { name: "Present", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Close", exact: true }).click();
  });
});

test.describe("events — full evidence cycle (approve)", () => {
  test("member registers, submits evidence, admin approves, points credited", async ({ browser }) => {
    // Admin creates the event.
    const adminContext = await browser.newContext({ storageState: AUTH_STATE.admin });
    const adminPage = await adminContext.newPage();
    const title = `Approve Cycle Event ${uniqueSuffix()}`;
    await adminPage.goto("/admin/events");
    await adminPage.getByRole("button", { name: "Create Event" }).click();
    await adminPage.getByLabel("Title").fill(title);
    await adminPage.getByLabel("Starts at").fill("2027-03-01T09:00");
    await adminPage.getByLabel("Target description").fill("Collect 50 signatures");
    await adminPage.getByLabel("Points reward").fill("30");
    await adminPage.getByRole("button", { name: "Create Event" }).click();
    await expect(adminPage.getByRole("row", { name: new RegExp(title) })).toBeVisible();

    // Member registers and submits evidence.
    const { context: memberContext, page: memberPage } = await createMemberSession(browser, `Evidence Member ${uniqueSuffix()}`);
    await memberPage.goto("/member/events");
    const memberCard = memberPage.locator('[data-slot="card"]').filter({ hasText: title });
    await memberCard.getByRole("button", { name: "Register" }).click();
    await expect(memberCard.getByRole("button", { name: "Register" })).toHaveCount(0);

    await memberCard.getByLabel("Note").fill("Collected 55 signatures at the community center");
    await memberCard.getByLabel("Quantity achieved (optional)").fill("55");
    await memberCard.getByRole("button", { name: "Attach photo" }).click();
    await memberCard.locator('input[type="file"]').setInputFiles(PHOTO);
    await memberCard.getByRole("button", { name: "Submit" }).click();
    await expect(memberCard.getByText("Pending review")).toBeVisible();

    // Admin approves via the Registrations sheet.
    const row = adminPage.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Manage" }).click();
    await expect(adminPage.getByText("PENDING REVIEW", { exact: true })).toBeVisible();
    await expect(adminPage.getByText("Collected 55 signatures")).toBeVisible();
    await expect(adminPage.getByText("Achieved: 55")).toBeVisible();
    await adminPage.getByRole("button", { name: "View evidence" }).click();
    await expect(adminPage.getByRole("link", { name: "Open evidence file" })).toBeVisible();
    await adminPage.getByRole("button", { name: "Approve" }).click();
    await expect(adminPage.getByText("APPROVED", { exact: true })).toBeVisible();

    // Member's wallet reflects the event's points reward.
    await memberPage.goto("/member/wallet");
    await expect(memberPage.getByText("+30", { exact: true })).toBeVisible();

    await adminContext.close();
    await memberContext.close();
  });
});

test.describe("events — reject and resubmission gap", () => {
  test("admin rejects evidence, member sees the reason, and resubmission is currently allowed (known gap)", async ({
    browser,
  }) => {
    const adminContext = await browser.newContext({ storageState: AUTH_STATE.admin });
    const adminPage = await adminContext.newPage();
    const title = `Reject Cycle Event ${uniqueSuffix()}`;
    await adminPage.goto("/admin/events");
    await adminPage.getByRole("button", { name: "Create Event" }).click();
    await adminPage.getByLabel("Title").fill(title);
    await adminPage.getByLabel("Starts at").fill("2027-03-15T09:00");
    await adminPage.getByLabel("Target description").fill("Distribute 20 food kits");
    await adminPage.getByLabel("Points reward").fill("15");
    await adminPage.getByRole("button", { name: "Create Event" }).click();

    const { context: memberContext, page: memberPage } = await createMemberSession(browser, `Reject Member ${uniqueSuffix()}`);
    await memberPage.goto("/member/events");
    const memberCard = memberPage.locator('[data-slot="card"]').filter({ hasText: title });
    await memberCard.getByRole("button", { name: "Register" }).click();
    await memberCard.getByLabel("Note").fill("Distributed kits to 10 families only");
    await memberCard.getByRole("button", { name: "Submit" }).click();
    await expect(memberCard.getByText("Pending review")).toBeVisible();

    const row = adminPage.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Manage" }).click();
    await adminPage.getByRole("button", { name: "Reject" }).click();
    await expect(adminPage.getByText("REJECTED", { exact: true })).toBeVisible();
    await adminPage.getByRole("button", { name: "Close", exact: true }).click();

    await memberPage.reload();
    const memberCardAfterReject = memberPage.locator('[data-slot="card"]').filter({ hasText: title });
    await expect(memberCardAfterReject.getByText("Rejected")).toBeVisible();

    // Known gap (documented, not fixed): submitEvidence has no completionStatus
    // guard, so a rejected registration can still be resubmitted — this
    // records that actual behavior rather than assuming it's blocked.
    await expect(memberCardAfterReject.getByLabel("Note")).toBeVisible();
    await memberCardAfterReject.getByLabel("Note").fill("Resubmission after rejection — distributed remaining kits");
    await memberCardAfterReject.getByRole("button", { name: "Submit" }).click();
    await expect(memberCardAfterReject.getByText("Pending review")).toBeVisible();

    await adminContext.close();
    await memberContext.close();
  });
});

test.describe("events — field executive restrictions", () => {
  test.use({ storageState: AUTH_STATE.fieldExecutive });

  test("Create Event button is absent; Manage stays available but read-only", async ({ page }) => {
    await page.goto("/admin/events");
    await expect(page.getByRole("button", { name: "Create Event" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Manage" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Manage" }).first().click();
    await expect(page.getByLabel("Register a member")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });
});

test.describe("events — remove registration", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("trash icon removes a registration after confirmation", async ({ page }) => {
    const title = `Removable Event ${uniqueSuffix()}`;
    await page.goto("/admin/events");
    await page.getByRole("button", { name: "Create Event" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Starts at").fill("2027-04-01T09:00");
    await page.getByRole("button", { name: "Create Event" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Manage" }).click();
    await page.locator("#add-member").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("No one registered yet.")).toHaveCount(0);

    await page.locator('button:has(svg.lucide-trash-2)').click();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No one registered yet.")).toBeVisible();
  });
});
