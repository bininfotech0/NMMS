import { Module } from "@nestjs/common";
import { CryptoService } from "../common/crypto.service";
import { KycMemberController } from "./kyc-member.controller";
import { KycAdminController } from "./kyc-admin.controller";
import { KycService } from "./kyc.service";

@Module({
  // KycMemberController before KycAdminController — see the routing comment
  // on KycMemberController for why the order matters.
  controllers: [KycMemberController, KycAdminController],
  providers: [KycService, CryptoService],
  exports: [KycService],
})
export class KycModule {}
