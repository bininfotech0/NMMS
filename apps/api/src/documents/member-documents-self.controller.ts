import { BadRequestException, Controller, Get, Param, Post, Req, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
// Side-effect import: pulls in @fastify/multipart's `declare module "fastify"`
// augmentation (adds request.parts()) into this file's own type-check pass.
import "@fastify/multipart";
import type { FastifyReply, FastifyRequest } from "fastify";
import { documentTypeSchema, type AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { DocumentsService } from "./documents.service";
import { MAX_RAW_UPLOAD_BYTES, processUpload } from "../common/upload.util";

function safeHeaderValue(value: string): string {
  return value.replace(/[\r\n"]/g, "");
}

// Own documents (including the PHOTO type) — registered before
// MemberDocumentsController in documents.module.ts so "GET
// /members/me/documents" isn't shadowed by ":memberId" treating "me" as an id.
@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("members/me/documents")
export class MemberDocumentsSelfController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findMine(@CurrentMember() member: AuthMember) {
    return this.documentsService.findMine(member.id);
  }

  @Get(":id/file")
  async download(
    @Param("id") id: string,
    @CurrentMember() member: AuthMember,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { stream, mimeType, fileName } = await this.documentsService.getFileForMember(id, member.id);
    res.header("Content-Type", mimeType);
    res.header("Content-Disposition", `inline; filename="${safeHeaderValue(fileName)}"`);
    return new StreamableFile(stream);
  }

  // A self-registered member uploading their own photo/ID proof — needed to
  // clear MembersService.submitInternal's document gate without staff
  // intervention. Same multipart handling as MemberDocumentsController.upload.
  @Post()
  async upload(@Req() req: FastifyRequest, @CurrentMember() member: AuthMember) {
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
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "FST_REQ_FILE_TOO_LARGE") {
        throw new BadRequestException(`File exceeds the ${MAX_RAW_UPLOAD_BYTES / (1024 * 1024)} MB upload limit`);
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

    fileBuffer = await processUpload(mimeType, fileBuffer);
    return this.documentsService.uploadMine(member.id, {
      type: type.data,
      fileName: fileName ?? "upload",
      mimeType,
      buffer: fileBuffer,
    });
  }
}
