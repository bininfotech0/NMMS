import { Module } from "@nestjs/common";
import { CryptoService } from "../common/crypto.service";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CryptoService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
