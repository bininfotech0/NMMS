import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { IdentityAutoFillController } from "./identity-auto-fill.controller";
import { OcrService } from "./ocr.service";

@Module({
  imports: [IntegrationsModule],
  controllers: [IdentityAutoFillController],
  providers: [OcrService],
})
export class OcrModule {}
