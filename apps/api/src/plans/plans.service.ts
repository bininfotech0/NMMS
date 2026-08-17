import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CreatePlanInput, PlanResponse, UpdatePlanInput } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<PlanResponse[]> {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    return plans.map(this.toPlanResponse);
  }

  async findOne(id: string, organizationId: string): Promise<PlanResponse> {
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id, organizationId } });
    if (!plan) {
      throw new NotFoundException("Membership plan not found");
    }
    return this.toPlanResponse(plan);
  }

  async create(dto: CreatePlanInput, organizationId: string): Promise<PlanResponse> {
    const plan = await this.prisma.membershipPlan.create({
      data: {
        organizationId,
        name: dto.name,
        tier: dto.tier ?? null,
        fee: dto.fee,
        validityType: dto.validityType,
        validityMonths: dto.validityType === "MONTHS" ? dto.validityMonths : null,
      },
    });
    return this.toPlanResponse(plan);
  }

  async update(id: string, dto: UpdatePlanInput, organizationId: string): Promise<PlanResponse> {
    const existing = await this.findOne(id, organizationId);

    const data: Prisma.MembershipPlanUpdateInput = { ...dto };
    if (dto.validityType === "LIFETIME") {
      data.validityMonths = null;
    }

    // createPlanSchema's superRefine enforces validityType/validityMonths
    // consistency, but updatePlanSchema can't — a PATCH may send only one of
    // the two fields, so the schema alone never sees the *effective* combined
    // state. Check it here instead, against what the plan will actually end
    // up with, to stop it landing in a MONTHS + null-validityMonths state
    // (silently treated as lifetime at approval time, but rejected at renewal
    // — see ApplicationsService/PaymentsService).
    const effectiveValidityType = dto.validityType ?? existing.validityType;
    const effectiveValidityMonths =
      dto.validityType === "LIFETIME"
        ? null
        : dto.validityMonths !== undefined
          ? dto.validityMonths
          : existing.validityMonths;
    if (effectiveValidityType === "MONTHS" && !effectiveValidityMonths) {
      throw new ConflictException("validityMonths is required when validityType is MONTHS");
    }

    const plan = await this.prisma.membershipPlan.update({ where: { id }, data });
    return this.toPlanResponse(plan);
  }

  private toPlanResponse(plan: {
    id: string;
    name: string;
    tier: string | null;
    fee: Prisma.Decimal;
    validityType: string;
    validityMonths: number | null;
    isActive: boolean;
  }): PlanResponse {
    return {
      id: plan.id,
      name: plan.name,
      tier: plan.tier as PlanResponse["tier"],
      fee: plan.fee.toNumber(),
      validityType: plan.validityType as PlanResponse["validityType"],
      validityMonths: plan.validityMonths,
      isActive: plan.isActive,
    };
  }
}
