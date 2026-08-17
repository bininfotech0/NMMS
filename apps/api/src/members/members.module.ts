import { Module } from "@nestjs/common";
import { AadhaarHashService } from "../common/aadhaar-hash.service";
import { DocumentStorageService } from "../common/document-storage.service";
import { NumberingService } from "../common/numbering.service";
import { UsersModule } from "../users/users.module";
import { MemberAuthModule } from "../member-auth/member-auth.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { MembersController } from "./members.controller";
import { MemberSelfController } from "./member-self.controller";
import { MembersService } from "./members.service";
import { MemberExpiryScheduler } from "./member-expiry.scheduler";

@Module({
  imports: [UsersModule, MemberAuthModule, IntegrationsModule],
  controllers: [MemberSelfController, MembersController],
  providers: [MembersService, AadhaarHashService, NumberingService, DocumentStorageService, MemberExpiryScheduler],
  exports: [MembersService],
})
export class MembersModule {}
