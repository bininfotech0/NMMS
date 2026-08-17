import { BadRequestException, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
// Side-effect import: pulls in @fastify/multipart's `declare module "fastify"`
// augmentation (adds request.parts()) into this file's own type-check pass.
import "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import type { AuthMember } from "@nmms/shared";
import { CurrentMember } from "../member-auth/decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "../member-auth/guards/member-jwt-auth.guard";
import { EventsService } from "./events.service";

// Member self-service: browse events, register, and submit evidence toward
// an event's target — mirrors the ReferralsController vs
// ReferralsAdminController split (member-guarded here, staff-guarded in
// EventsController).
@ApiTags("events")
@ApiBearerAuth()
@UseGuards(MemberJwtAuthGuard)
@Controller("events")
export class MemberEventsController {
  constructor(private readonly eventsService: EventsService) {}

  // "mine" rather than "me" so this static route can never be shadowed by
  // the staff EventsController's GET events/:id.
  @Get("mine")
  listMine(@CurrentMember() member: AuthMember) {
    return this.eventsService.listForMember(member);
  }

  @Post(":id/register")
  register(@Param("id") id: string, @CurrentMember() member: AuthMember) {
    return this.eventsService.registerSelf(id, member);
  }

  @Post(":id/registrations/me/evidence")
  async submitEvidence(
    @Param("id") id: string,
    @Req() req: FastifyRequest,
    @CurrentMember() member: AuthMember,
  ) {
    let fileBuffer: Buffer | undefined;
    let mimeType: string | undefined;
    let fileName: string | undefined;
    let note: string | undefined;
    let quantityAchieved: string | undefined;

    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          fileBuffer = await part.toBuffer();
          mimeType = part.mimetype;
          fileName = part.filename;
        } else if (part.fieldname === "note") {
          note = String(part.value);
        } else if (part.fieldname === "quantityAchieved") {
          quantityAchieved = String(part.value);
        }
      }
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "FST_REQ_FILE_TOO_LARGE") {
        throw new BadRequestException("File exceeds the upload limit");
      }
      throw new BadRequestException("Could not process the uploaded file");
    }

    return this.eventsService.submitEvidence(
      id,
      member,
      {
        note: note || null,
        quantityAchieved: quantityAchieved ? Number(quantityAchieved) : null,
      },
      fileBuffer && mimeType ? { buffer: fileBuffer, mimeType, fileName: fileName ?? "upload" } : undefined,
    );
  }
}
