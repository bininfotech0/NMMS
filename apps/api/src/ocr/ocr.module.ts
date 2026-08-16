import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { IdentityAutoFillController } from "./identity-auto-fill.controller";
import { OcrService } from "./ocr.service";
import { ClaudeOcrProvider } from "./providers/claude-ocr-provider";

@Module({
  imports: [IntegrationsModule],
  controllers: [IdentityAutoFillController],
  providers: [OcrService, ClaudeOcrProvider],
})
export class OcrModule {}
