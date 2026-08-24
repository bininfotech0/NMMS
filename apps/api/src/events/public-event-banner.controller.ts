import { Controller, Get, Param, Res, StreamableFile } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { EventsService } from "./events.service";

// No JwtAuthGuard of any kind — event banners are promotional content and
// event ids are non-enumerable cuids, same access-control precedent as
// PublicCardController's QR-scan endpoint.
@ApiTags("events")
@Controller("public/events")
export class PublicEventBannerController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(":id/banner")
  async banner(@Param("id") id: string, @Res({ passthrough: true }) res: FastifyReply) {
    const { stream, mimeType } = await this.eventsService.getBannerFile(id);
    res.header("Content-Type", mimeType);
    return new StreamableFile(stream);
  }
}
