import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTH_STATE, uniqueMobile } from "./support/constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO = path.join(__dirname, "..", "fixtures", "photo.jpg");
const PDF = path.join(__dirname, "..", "fixtures", "sample.pdf");

const DOCUMENT_SLOTS = [
  "PHOTO",
  "SIGNATURE",
  "AADHAAR_FRONT",
  "AADHAAR_BACK",
  "PAN",
  "VOTER_ID",
  "PASSPORT",
  "DRIVING_LICENCE",
  "GOVERNMENT_ID",
  "ADDRESS_PROOF",
  "QUALIFICATION_CERTIFICATE",
  "OTHER",
];

async function selectFirstOptionIfAvailable(page: Page, id: string) {
  const select = page.locator(`#${id}`);
  const count = await select.locator("option").count();
  if (count > 1) {
    await select.selectOption({ index: 1 });
  }
}

async function addDraftMember(page: Page, fullName: string, mobile: string) {
  await page.goto("/admin/members");
  await page.getByRole("button", { name: "Add Member" }).click();
  await page.getByLabel("Full name").fill(fullName);
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByRole("button", { name: "Create Draft" }).click();
  await page.waitForURL(/\/admin\/members\/[^/]+\/wizard/);
}

test.describe("member registration wizard", () => {
  test.use({ storageState: AUTH_STATE.admin });

  test("Add Member warns on a known-duplicate mobile and creates a fresh draft otherwise", async ({ page }) => {
    const firstMobile = uniqueMobile();
    await addDraftMember(page, "Dedupe Source Member", firstMobile);

    await page.goto("/admin/members");
    await page.getByRole("button", { name: "Add Member" }).click();
    await page.getByLabel("Full name").fill("Dedupe Attempt Member");
    await page.getByLabel("Mobile number").fill(firstMobile);
    await page.getByLabel("Mobile number").blur();
    await expect(page.getByText(/matches an existing member/i)).toBeVisible();

    await page.getByLabel("Mobile number").fill(uniqueMobile());
    await page.getByLabel("Mobile number").blur();
    await expect(page.getByText(/matches an existing member/i)).toHaveCount(0);
  });

  test("Save Draft persists mid-wizard and reloading the wizard shows saved values", async ({ page }) => {
    await addDraftMember(page, "Save Draft Member", uniqueMobile());
    // currentStep is local component state (not URL-derived), so a reload
    // always lands back on step 1 — advance to step 2 first, save from
    // there, then reload and navigate back to step 2 to check persistence.
    await page.getByRole("button", { name: "Save & Continue" }).click();
    await expect(page.getByText("Step 2 of 10")).toBeVisible();
    await page.getByLabel("First name").fill("SaveDraftFirstName");
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByRole("button", { name: "Save Draft" })).toBeEnabled();

    await page.reload();
    await expect(page.getByText("Step 1 of 10")).toBeVisible();
    await page.getByRole("button", { name: "Save & Continue" }).click();
    await expect(page.getByLabel("First name")).toHaveValue("SaveDraftFirstName");
  });

  test("Previous/Save & Continue navigation moves between steps and updates the progress label", async ({ page }) => {
    await addDraftMember(page, "Step Nav Member", uniqueMobile());
    await expect(page.getByText("Step 1 of 10")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();

    await page.getByRole("button", { name: "Save & Continue" }).click();
    await expect(page.getByText("Step 2 of 10")).toBeVisible();

    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText("Step 1 of 10")).toBeVisible();
  });

  test("referrer typeahead searches, selects, and clears", async ({ page }) => {
    await addDraftMember(page, "Referrer Search Member", uniqueMobile());
    await page.getByLabel("Referred by (optional)").fill("E2E Shared Member");
    const option = page.getByRole("button", { name: /E2E Shared Member/ });
    await expect(option).toBeVisible();
    await option.click();
    // The selected chip renders "{fullName} ({referralCode})" as one span with
    // a nested code span, so an exact match on just the name never matches.
    await expect(page.getByText("E2E Shared Member")).toBeVisible();

    await page.getByRole("button", { name: "Clear referrer" }).click();
    await expect(page.getByLabel("Referred by (optional)")).toBeVisible();
  });

  test("full 10-step walkthrough with offline payment and document uploads ends in SUBMITTED", async ({ page }) => {
    const mobile = uniqueMobile();
    await addDraftMember(page, "Full Cycle Wizard Member", mobile);

    // Step 1 — Membership: plan is required for the Payment step to work.
    await expect(page.getByText("Step 1 of 10")).toBeVisible();
    await selectFirstOptionIfAvailable(page, "planId");
    await selectFirstOptionIfAvailable(page, "membershipCategoryId");
    await selectFirstOptionIfAvailable(page, "branchId");
    await page.getByLabel("Joining date").fill("2026-01-01");
    await page.getByLabel("Fee override (optional)").fill("");
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 2 — Basic Information
    await expect(page.getByText("Step 2 of 10")).toBeVisible();
    await page.getByLabel("First name").fill("Full");
    await page.getByLabel("Middle name").fill("");
    await page.getByLabel("Last name").fill("Cycle");
    await expect(page.getByLabel("Full name")).toHaveValue("Full Cycle");
    await selectFirstOptionIfAvailable(page, "gender");
    await page.getByLabel("Date of birth").fill("1990-05-15");
    await selectFirstOptionIfAvailable(page, "maritalStatus");
    await page.getByLabel("Blood group").fill("O+");
    await page.getByLabel("Nationality").fill("Indian");
    await selectFirstOptionIfAvailable(page, "religionId");
    await selectFirstOptionIfAvailable(page, "casteCategoryId");
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 3 — Personal Information
    await expect(page.getByText("Step 3 of 10")).toBeVisible();
    await page.getByLabel("Father's name").fill("Father Name");
    await page.getByLabel("Mother's name").fill("Mother Name");
    await selectFirstOptionIfAvailable(page, "familyTypeId");
    await page.getByLabel("Family members count").fill("4");
    await page.getByLabel("Children count").fill("1");
    await page.getByLabel("Monthly income").fill("25000");
    await page.getByLabel("Differently abled").check();
    await page.getByLabel("Senior citizen").check();
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 4 — Contact & Address
    await expect(page.getByText("Step 4 of 10")).toBeVisible();
    await page.getByLabel("WhatsApp number").fill(mobile);
    await page.getByLabel("Email").fill(`e2e.${mobile}@example.com`);
    // "Full address"/"Pincode" labels are duplicated (current + permanent
    // address blocks) — scope by the AddressFields idPrefix instead.
    await page.locator("#current-addressLine").fill("42 Wizard Test Lane");
    await page.locator("#current-pincode").fill("110001");
    await page.getByLabel("Same as current address").check();
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 5 — Education & Occupation
    await expect(page.getByText("Step 5 of 10")).toBeVisible();
    await selectFirstOptionIfAvailable(page, "educationId");
    await page.getByLabel("Qualification detail").fill("B.Tech");
    await selectFirstOptionIfAvailable(page, "occupationId");
    await page.getByLabel("Languages known").fill("Hindi, English");
    await page.getByLabel("Skills").fill("Teaching");
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 6 — Payment Collection (offline path)
    await expect(page.getByText("Step 6 of 10")).toBeVisible();
    const offlineToggle = page.getByRole("button", { name: "Record an offline payment instead" });
    if (await offlineToggle.count()) {
      await offlineToggle.click();
    }
    await page.getByRole("button", { name: "Collect Payment" }).click();
    await expect(page.getByText("Registration fee collected")).toBeVisible();
    // The wizard's own member query needs its refetch to land before
    // paymentBlocked flips false — wait for the button to actually be
    // enabled rather than racing a click against that.
    const continueAfterPayment = page.getByRole("button", { name: "Save & Continue" });
    await expect(continueAfterPayment).toBeEnabled();
    await continueAfterPayment.click();

    // Step 7 — Identity & Documents
    await expect(page.getByText("Step 7 of 10")).toBeVisible();
    await page.getByLabel("Aadhaar number").fill("123412341234");
    await page.getByLabel("PAN").fill("ABCDE1234F");
    for (const slot of DOCUMENT_SLOTS) {
      const container = page.getByTestId(`document-slot-${slot}`);
      const file = slot === "PASSPORT" || slot === "OTHER" ? PDF : PHOTO;
      await container.locator('input[type="file"]').setInputFiles(file);
      await expect(container.getByRole("button", { name: "Replace" })).toBeVisible({ timeout: 15_000 });
    }
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 8 — Nominee & Emergency Contact
    await expect(page.getByText("Step 8 of 10")).toBeVisible();
    await page.locator("#emergencyContactName").fill("Emergency Contact");
    await page.locator("#emergencyContactMobile").fill(mobile);
    await page.locator("#emergencyContactRelationship").fill("Sibling");
    await page.locator("#nomineeName").fill("Nominee Name");
    await page.locator("#nomineeRelationship").fill("Spouse");
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 9 — Declaration & Signature
    await expect(page.getByText("Step 9 of 10")).toBeVisible();
    await page.getByLabel("I declare that the information provided is correct.").check();
    await page.getByLabel("I accept the organization's constitution.").check();
    await page.getByLabel("I accept the privacy policy.").check();
    await page.getByLabel("I accept the terms & conditions.").check();
    await page.getByLabel("Place").fill("New Delhi");
    await page.getByLabel("Date").fill("2026-01-01");
    await page.getByRole("button", { name: "Save & Continue" }).click();

    // Step 10 — Review & Submit
    await expect(page.getByText("Step 10 of 10")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Full Cycle" })).toBeVisible();
    await expect(page.getByText("Yes").first()).toBeVisible(); // declarations accepted
    await page.getByRole("button", { name: "Submit Application" }).click();
    await expect(page.getByText("Submit this application?")).toBeVisible();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.waitForURL("**/admin/members");

    await page.getByPlaceholder("Search by name, ID, mobile, or email...").fill(mobile);
    await expect(page.getByRole("table").getByText("Full Cycle")).toBeVisible();
    await expect(page.getByRole("table").getByText("Submitted")).toBeVisible();
  });
});
