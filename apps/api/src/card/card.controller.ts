import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CardService } from "./card.service";

@ApiTags("card")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("members")
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get(":id/card-token")
  mintToken(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.cardService.mintToken(id, user);
  }
}
