import { Injectable } from "@nestjs/common";
import { FeatureFlagKey, type DocumentType } from "@prisma/client";
import type { IdentityAutoFillResponse } from "@nmms/shared";
import { IntegrationsService } from "../integrations/integrations.service";
import { ClaudeOcrProvider } from "./providers/claude-ocr-provider";

const EMPTY_RESULT: IdentityAutoFillResponse = {
  fullName: null,
  dob: null,
  gender: null,
  aadhaarNumber: null,
  pan: null,
  voterId: null,
  passportNumber: null,
  drivingLicenceNumber: null,
};

@Injectable()
export class OcrService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly provider: ClaudeOcrProvider,
  ) {}

  async extract(
    document: Buffer,
    mimeType: string,
    docType: DocumentType,
    organizationId: string,
  ): Promise<IdentityAutoFillResponse> {
    const enabled = await this.integrations.isEnabled(FeatureFlagKey.AI_OCR, organizationId);
    if (!enabled) {
      return EMPTY_RESULT;
    }
    const extracted = await this.provider.extract(document, mimeType, docType);
    return { ...EMPTY_RESULT, ...extracted };
  }
}
