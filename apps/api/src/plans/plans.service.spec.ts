import { Prisma } from "@prisma/client";
import { ConflictException } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { makeMockPrisma } from "../test/fixtures";

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    organizationId: "org-1",
    name: "Standard",
    tier: null,
    fee: new Prisma.Decimal(500),
    validityType: "MONTHS",
    validityMonths: 12,
    isActive: true,
    ...overrides,
  };
}

describe("PlansService.update", () => {
  function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
    return new PlansService(prisma as never);
  }

  it("rejects switching to MONTHS without supplying validityMonths, even though it's just a partial PATCH", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    // Existing plan is LIFETIME (validityMonths already null) — switching
    // validityType to MONTHS alone must not silently keep it null.
    prisma.membershipPlan.findFirst.mockResolvedValue(
      makePlan({ validityType: "LIFETIME", validityMonths: null }),
    );

    await expect(service.update("plan-1", { validityType: "MONTHS" }, "org-1")).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.membershipPlan.update).not.toHaveBeenCalled();
  });

  it("rejects clearing validityMonths on a plan that's already MONTHS-typed", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    prisma.membershipPlan.findFirst.mockResolvedValue(makePlan());

    await expect(service.update("plan-1", { validityMonths: null }, "org-1")).rejects.toThrow(
      ConflictException,
    );
  });

  it("allows switching to LIFETIME without validityMonths", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    prisma.membershipPlan.findFirst.mockResolvedValue(makePlan());
    prisma.membershipPlan.update.mockResolvedValue(
      makePlan({ validityType: "LIFETIME", validityMonths: null }),
    );

    await service.update("plan-1", { validityType: "LIFETIME" }, "org-1");

    expect(prisma.membershipPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" }, data: expect.objectContaining({ validityMonths: null }) }),
    );
  });

  it("allows a partial update that leaves an already-consistent MONTHS plan untouched", async () => {
    const prisma = makeMockPrisma();
    const service = makeService(prisma);
    prisma.membershipPlan.findFirst.mockResolvedValue(makePlan());
    prisma.membershipPlan.update.mockResolvedValue(makePlan({ fee: new Prisma.Decimal(600) }));

    await service.update("plan-1", { fee: 600 }, "org-1");

    expect(prisma.membershipPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" }, data: expect.objectContaining({ fee: 600 }) }),
    );
  });
});
