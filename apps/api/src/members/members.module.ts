import { Module } from "@nestjs/common";
import { AadhaarHashService } from "../common/aadhaar-hash.service";
import { DocumentStorageService } from "../common/document-storage.service";
import { NumberingService } from "../common/numbering.service";
import { UsersModule } from "../users/users.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [UsersModule],
  controllers: [MembersController],
  providers: [MembersService, AadhaarHashService, NumberingService, DocumentStorageService],
  exports: [MembersService],
})
export class MembersModule {}
