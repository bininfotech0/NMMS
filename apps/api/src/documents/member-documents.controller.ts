import { BadRequestException, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
// Side-effect import: pulls in @fastify/multipart's `declare module "fastify"`
// augmentation (adds request.parts()) into this file's own type-check pass.
import "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import { documentTypeSchema, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DocumentsService } from "./documents.service";

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("members/:memberId/documents")
export class MemberDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findByMember(@Param("memberId") memberId: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.findByMember(memberId, user);
  }

  @Post()
  async upload(
    @Param("memberId") memberId: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
  ) {
    let fileBuffer: Buffer | undefined;
    let mimeType: string | undefined;
    let fileName: string | undefined;
    let typeValue: string | undefined;

    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          fileBuffer = await part.toBuffer();
          mimeType = part.mimetype;
          fileName = part.filename;
        } else if (part.fieldname === "type") {
          typeValue = String(part.value);
        }
      }
    } catch {
      throw new BadRequestException("File exceeds the 2 MB upload limit");
    }

    if (!fileBuffer || !mimeType) {
      throw new BadRequestException("A file is required");
    }
    const type = documentTypeSchema.safeParse(typeValue);
    if (!type.success) {
      throw new BadRequestException("A valid document type is required");
    }

    return this.documentsService.upload(
      memberId,
      { type: type.data, fileName: fileName ?? "upload", mimeType, buffer: fileBuffer },
      user,
    );
  }
}
