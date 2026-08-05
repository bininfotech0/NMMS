import { Injectable } from "@nestjs/common";
import { FeatureFlagKey, type DocumentType } from "@prisma/client";
import type { IdentityAutoFillResponse } from "@nmms/shared";
import { IntegrationsService } from "../integrations/integrations.service";

export interface OcrProvider {
  extract(document: Buffer, docType: DocumentType): Promise<Partial<IdentityAutoFillResponse>>;
}

// No OCR vendor is integrated yet — auto-fill always falls back to manual
// entry. Swap this out for a real provider once one is chosen; the AI_OCR
// feature flag (checked in OcrService.extract) is the gate that controls
// whether extraction is even attempted.
class NoOpOcrProvider implements OcrProvider {
  async extract(): Promise<Partial<IdentityAutoFillResponse>> {
    return {};
  }
}

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
  private readonly provider: OcrProvider = new NoOpOcrProvider();

  constructor(private readonly integrations: IntegrationsService) {}

  async extract(
    document: Buffer,
    docType: DocumentType,
    organizationId: string,
  ): Promise<IdentityAutoFillResponse> {
    const enabled = await this.integrations.isEnabled(FeatureFlagKey.AI_OCR, organizationId);
    if (!enabled) {
      return EMPTY_RESULT;
    }
    const extracted = await this.provider.extract(document, docType);
    return { ...EMPTY_RESULT, ...extracted };
  }
}
