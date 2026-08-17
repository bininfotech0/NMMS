import { BadRequestException, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
// Side-effect import: pulls in @fastify/multipart's `declare module "fastify"`
// augmentation (adds request.parts()) into this file's own type-check pass.
import "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import { documentTypeSchema, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OcrService } from "./ocr.service";

@ApiTags("ocr")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("members/:memberId/identity")
export class IdentityAutoFillController {
  constructor(private readonly ocrService: OcrService) {}

  // memberId isn't used for scoping here — the extracted fields are never
  // persisted server-side, only returned for the caller to review and save
  // via the normal PATCH /members/:id flow (which does enforce ownership).
  @Post("auto-fill")
  async autoFill(@Param("memberId") _memberId: string, @Req() req: FastifyRequest, @CurrentUser() user: AuthUser) {
    let fileBuffer: Buffer | undefined;
    let mimeType: string | undefined;
    let typeValue: string | undefined;

    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          fileBuffer = await part.toBuffer();
          mimeType = part.mimetype;
        } else if (part.fieldname === "type") {
          typeValue = String(part.value);
        }
      }
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "FST_REQ_FILE_TOO_LARGE") {
        throw new BadRequestException("File exceeds the 2 MB upload limit");
      }
      throw new BadRequestException("Could not process the uploaded file");
    }

    if (!fileBuffer || !mimeType) {
      throw new BadRequestException("A file is required");
    }
    const type = documentTypeSchema.safeParse(typeValue);
    if (!type.success) {
      throw new BadRequestException("A valid document type is required");
    }

    return this.ocrService.extract(fileBuffer, mimeType, type.data, user.organizationId);
  }
}
