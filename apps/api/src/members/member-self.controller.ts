import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { PlansService } from "../plans/plans.service";
import { MembersService } from "./members.service";
import { MemberSelfUpdateDto } from "./dto/member-self-update.dto";
import { SelectMemberPlanDto } from "./dto/select-member-plan.dto";

// Own profile — a curated, self-editable subset (see memberSelfUpdateSchema),
// plus the self-service registration actions a DRAFT member needs to reach
// SUBMITTED without staff involvement (select a plan, submit for review).
// Registered before MembersController in members.module.ts so "GET/PATCH
// /members/me" isn't shadowed by the staff controller's "/members/:id"
// treating "me" as an id.
@ApiTags("members")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("members")
export class MemberSelfController {
  constructor(
    private readonly membersService: MembersService,
    private readonly plansService: PlansService,
  ) {}

  @Get("me")
  getMe(@CurrentMember() member: AuthMember) {
    return this.membersService.getMe(member.id);
  }

  @Patch("me")
  updateMe(@Body() dto: MemberSelfUpdateDto, @CurrentMember() member: AuthMember) {
    return this.membersService.updateMe(member.id, dto);
  }

  // Active plans only — a member choosing their own plan should never be
  // offered a retired one, unlike staff's /plans which lists everything for
  // management purposes.
  @Get("me/plans")
  async listAvailablePlans(@CurrentMember() member: AuthMember) {
    const plans = await this.plansService.findAll(member.organizationId);
    return plans.filter((p) => p.isActive);
  }

  @Post("me/plan")
  selectMyPlan(@Body() dto: SelectMemberPlanDto, @CurrentMember() member: AuthMember) {
    return this.membersService.selectMyPlan(member.id, dto.planId);
  }

  @Post("me/submit")
  submitMine(@CurrentMember() member: AuthMember) {
    return this.membersService.submitMine(member.id);
  }
}
