import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { MembersService } from "./members.service";
import { MemberSelfUpdateDto } from "./dto/member-self-update.dto";

// Own profile — a curated, self-editable subset (see memberSelfUpdateSchema).
// Registered before MembersController in members.module.ts so "GET/PATCH
// /members/me" isn't shadowed by the staff controller's "/members/:id"
// treating "me" as an id.
@ApiTags("members")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("members")
export class MemberSelfController {
  constructor(private readonly membersService: MembersService) {}

  @Get("me")
  getMe(@CurrentMember() member: AuthMember) {
    return this.membersService.getMe(member.id);
  }

  @Patch("me")
  updateMe(@Body() dto: MemberSelfUpdateDto, @CurrentMember() member: AuthMember) {
    return this.membersService.updateMe(member.id, dto);
  }
}
