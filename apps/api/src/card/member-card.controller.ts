import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { CardService } from "./card.service";

// Own membership card — registered before CardController in card.module.ts
// so "GET /members/me/card-token" isn't shadowed by ":id" treating "me" as
// an id.
@ApiTags("card")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("members/me")
export class MemberCardController {
  constructor(private readonly cardService: CardService) {}

  @Get("card-token")
  mintOwnToken(@CurrentMember() member: AuthMember) {
    return this.cardService.mintOwnToken(member.id);
  }
}
