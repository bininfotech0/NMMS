import { Module } from "@nestjs/common";
import { LookupsController } from "./lookups.controller";
import { LookupsMemberController } from "./lookups-member.controller";
import { LookupsService } from "./lookups.service";

@Module({
  controllers: [LookupsMemberController, LookupsController],
  providers: [LookupsService],
})
export class MastersModule {}
