import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember, LookupCategory } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { LookupsService } from "./lookups.service";

// Read-only lookups for the member portal's self-service profile page
// (religion/caste/family type/education/occupation/business type dropdowns)
// — LookupsController is entirely staff-gated, so a member JWT can't use it.
// Registered before LookupsController in masters.module.ts, same "me" vs
// ":id"-shaped ordering reasoning as MemberSelfController/KycMemberController
// (not strictly needed here since there's no ":id" route on this path, but
// kept consistent with the established convention).
@ApiTags("masters")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("masters/lookups")
export class LookupsMemberController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get("me")
  findAll(@Query("category") category: LookupCategory | undefined, @CurrentMember() member: AuthMember) {
    return this.lookupsService.findAll(member.organizationId, category);
  }
}
