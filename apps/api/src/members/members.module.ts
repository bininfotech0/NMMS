import { Module } from "@nestjs/common";
import { AadhaarHashService } from "../common/aadhaar-hash.service";
import { NumberingService } from "../common/numbering.service";
import { UsersModule } from "../users/users.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [UsersModule],
  controllers: [MembersController],
  providers: [MembersService, AadhaarHashService, NumberingService],
  exports: [MembersService],
})
export class MembersModule {}
