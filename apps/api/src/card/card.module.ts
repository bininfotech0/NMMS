import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MembersModule } from "../members/members.module";
import { CardController } from "./card.controller";
import { MemberCardController } from "./member-card.controller";
import { PublicCardController } from "./public-card.controller";
import { CardService } from "./card.service";

@Module({
  imports: [MembersModule, JwtModule.register({})],
  // MemberCardController ("members/me") registered before CardController
  // ("members/:id") so "me" isn't shadowed by ":id".
  controllers: [MemberCardController, CardController, PublicCardController],
  providers: [CardService],
})
export class CardModule {}
