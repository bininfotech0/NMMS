import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { NoticesService } from "./notices.service";

// Separate path (not "notices/me") so it can never be shadowed by the staff
// NoticesController's "notices/:id" route.
@ApiTags("Notices")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("member-notices")
export class MemberNoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  list(@CurrentMember() member: AuthMember) {
    return this.noticesService.getForMembers(member.organizationId);
  }
}
