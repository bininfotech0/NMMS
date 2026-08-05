import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MembersModule } from "../members/members.module";
import { CardController } from "./card.controller";
import { PublicCardController } from "./public-card.controller";
import { CardService } from "./card.service";

@Module({
  imports: [MembersModule, JwtModule.register({})],
  controllers: [CardController, PublicCardController],
  providers: [CardService],
})
export class CardModule {}
