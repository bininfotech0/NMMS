import { Controller, Delete, Get, HttpCode, Param, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DocumentsService } from "./documents.service";

function safeHeaderValue(value: string): string {
  return value.replace(/[\r\n"]/g, "");
}

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.documentsService.findAll(user);
  }

  @Get(":id/file")
  async download(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { stream, mimeType, fileName } = await this.documentsService.getFile(id, user);
    res.header("Content-Type", mimeType);
    res.header("Content-Disposition", `inline; filename="${safeHeaderValue(fileName)}"`);
    return new StreamableFile(stream);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.remove(id, user);
  }
}
