import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CardService } from "./card.service";

// No JwtAuthGuard — this is the public QR-scan endpoint, reachable by anyone
// holding a physical membership card. See CardService.verify for what's
// deliberately withheld (photo, mobile, address, etc).
@ApiTags("card")
@Controller("public/cards")
export class PublicCardController {
  constructor(private readonly cardService: CardService) {}

  @Get("verify/:token")
  verify(@Param("token") token: string) {
    return this.cardService.verify(token);
  }
}
