import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// zodOutputFormat() is typed against zod's v4 API specifically (z.ZodType
// from "zod/v4"), which the installed zod@3.25 package ships as a bundled
// compatibility export — plain "zod" (the v3 API) doesn't structurally match.
import * as z from "zod/v4";
import type { DocumentType } from "@prisma/client";
import type { IdentityAutoFillResponse } from "@nmms/shared";

// Image formats Claude's vision input accepts — anything else (PDF scans,
// etc.) isn't attempted, since this path only ever receives camera/gallery
// captures from the registration wizard, not document uploads generally.
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const ExtractionSchema = z.object({
  fullName: z.string().nullable(),
  dob: z.string().nullable().describe("Date of birth as YYYY-MM-DD, or null if not legible/present"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable(),
  aadhaarNumber: z.string().nullable().describe("12-digit Aadhaar number, digits only"),
  pan: z.string().nullable().describe("10-character PAN"),
  voterId: z.string().nullable(),
  passportNumber: z.string().nullable(),
  drivingLicenceNumber: z.string().nullable(),
});

const DOC_TYPE_LABELS: Partial<Record<DocumentType, string>> = {
  AADHAAR: "Aadhaar card",
  AADHAAR_FRONT: "the front of an Aadhaar card",
  AADHAAR_BACK: "the back of an Aadhaar card",
  PAN: "PAN card",
  VOTER_ID: "Voter ID card",
  PASSPORT: "passport",
  DRIVING_LICENCE: "driving licence",
  GOVERNMENT_ID: "government-issued ID card",
};

@Injectable()
export class ClaudeOcrProvider {
  private readonly logger = new Logger(ClaudeOcrProvider.name);
  private readonly client: Anthropic;

  constructor(config: ConfigService) {
    this.client = new Anthropic({ apiKey: config.getOrThrow<string>("ANTHROPIC_API_KEY") });
  }

  async extract(
    document: Buffer,
    mimeType: string,
    docType: DocumentType,
  ): Promise<Partial<IdentityAutoFillResponse>> {
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      return {};
    }

    try {
      const documentLabel = DOC_TYPE_LABELS[docType] ?? "identity document";
      const response = await this.client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: document.toString("base64"),
                },
              },
              {
                type: "text",
                text: `This image is ${documentLabel}. Extract every identity field you can confidently read. Leave a field null if it isn't present or isn't legible — never guess.`,
              },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(ExtractionSchema) },
      });

      const parsed = response.parsed_output;
      if (!parsed) {
        return {};
      }
      return {
        fullName: parsed.fullName,
        dob: parsed.dob ? new Date(parsed.dob) : null,
        gender: parsed.gender,
        aadhaarNumber: parsed.aadhaarNumber,
        pan: parsed.pan,
        voterId: parsed.voterId,
        passportNumber: parsed.passportNumber,
        drivingLicenceNumber: parsed.drivingLicenceNumber,
      };
    } catch (err) {
      this.logger.error("Claude OCR extraction failed", err instanceof Error ? err.stack : err);
      return {};
    }
  }
}
