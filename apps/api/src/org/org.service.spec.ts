import { Prisma } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { OrgService } from "./org.service";
import { makeMockPrisma } from "../test/fixtures";

function makeExistingSettings(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    logoUrl: null,
    address: null,
    contactEmail: null,
    contactPhone: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankIfscCode: null,
    bankName: null,
    membershipNumberFormat: "MEM-{SEQ}",
    receiptNumberFormat: "RCP-{SEQ}",
    referralProgramEnabled: true,
    pointsPerApprovedReferral: 10,
    referralPointsCapPerMember: null,
    referralRequireActiveReferrerPlan: false,
    pointsToMoneyRatioPoints: 100,
    pointsToMoneyRatioAmount: new Prisma.Decimal(10),
    kycRequireAadhaar: true,
    kycRequirePan: false,
    kycRequireBankOrUpi: true,
    withdrawalMinAmount: new Prisma.Decimal(100),
    withdrawalMaxAmount: null as Prisma.Decimal | null,
    withdrawalFrequencyDays: null,
    withdrawalChargeType: "NONE",
    withdrawalChargeValue: new Prisma.Decimal(0),
    ...overrides,
  };
}

describe("OrgService.update", () => {
  function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
    return new OrgService(prisma as never);
  }

  it("rejects a PERCENTAGE withdrawal charge over 100%", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({ id: "org-1", name: "Org" });
    prisma.orgSettings.upsert.mockResolvedValue(makeExistingSettings());

    await expect(
      service.update("org-1", { withdrawalChargeType: "PERCENTAGE", withdrawalChargeValue: 150 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.orgSettings.update).not.toHaveBeenCalled();
  });

  it("rejects a PERCENTAGE charge value update alone when the org's already-stored type is PERCENTAGE", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({ id: "org-1", name: "Org" });
    prisma.orgSettings.upsert.mockResolvedValue(
      makeExistingSettings({ withdrawalChargeType: "PERCENTAGE", withdrawalChargeValue: new Prisma.Decimal(20) }),
    );

    await expect(service.update("org-1", { withdrawalChargeValue: 200 })).rejects.toThrow(BadRequestException);
  });

  it("rejects withdrawalMinAmount greater than withdrawalMaxAmount", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({ id: "org-1", name: "Org" });
    prisma.orgSettings.upsert.mockResolvedValue(makeExistingSettings());

    await expect(
      service.update("org-1", { withdrawalMinAmount: 1000, withdrawalMaxAmount: 500 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.orgSettings.update).not.toHaveBeenCalled();
  });

  it("accepts a valid combination and persists it", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({ id: "org-1", name: "Org" });
    prisma.orgSettings.upsert.mockResolvedValue(makeExistingSettings());
    prisma.orgSettings.update.mockResolvedValue(
      makeExistingSettings({ withdrawalChargeType: "PERCENTAGE", withdrawalChargeValue: new Prisma.Decimal(5) }),
    );

    await service.update("org-1", { withdrawalChargeType: "PERCENTAGE", withdrawalChargeValue: 5 });

    expect(prisma.orgSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        data: expect.objectContaining({ withdrawalChargeType: "PERCENTAGE", withdrawalChargeValue: 5 }),
      }),
    );
  });
});
