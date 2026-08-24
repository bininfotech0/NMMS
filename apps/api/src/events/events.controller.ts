import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
// Side-effect import: pulls in @fastify/multipart's `declare module "fastify"`
// augmentation (adds request.parts()) into this file's own type-check pass.
import "@fastify/multipart";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { RegisterMemberDto } from "./dto/register-member.dto";
import { SetAttendanceDto } from "./dto/set-attendance.dto";
import { ReviewEventEvidenceDto } from "./dto/review-event-evidence.dto";
import { EventsService } from "./events.service";

const REVIEWER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN] as const;

@ApiTags("events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.eventsService.findAll(user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.eventsService.create(dto, user);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: AuthUser) {
    return this.eventsService.update(id, dto, user);
  }

  @Post(":id/banner")
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  async uploadBanner(@Param("id") id: string, @Req() req: FastifyRequest, @CurrentUser() user: AuthUser) {
    let fileBuffer: Buffer | undefined;
    let mimeType: string | undefined;

    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          fileBuffer = await part.toBuffer();
          mimeType = part.mimetype;
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
    return this.eventsService.uploadBanner(id, { mimeType, buffer: fileBuffer }, user);
  }

  @Delete(":id/banner")
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  removeBanner(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.removeBanner(id, user);
  }

  @Get(":id/registrations")
  listRegistrations(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.listRegistrations(id, user);
  }

  @Post(":id/registrations")
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  registerMember(
    @Param("id") id: string,
    @Body() dto: RegisterMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.registerMember(id, dto.memberId, user);
  }

  @Get(":id/registrations/pending-review")
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  listPendingReview(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.listPendingReview(id, user);
  }

  @Get(":id/registrations/:registrationId/evidence")
  async downloadEvidence(
    @Param("id") id: string,
    @Param("registrationId") registrationId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { stream, mimeType, fileName } = await this.eventsService.getEvidenceFile(id, registrationId, user);
    res.header("Content-Type", mimeType);
    res.header("Content-Disposition", `inline; filename="${fileName.replace(/[\r\n"]/g, "")}"`);
    return new StreamableFile(stream);
  }

  @Post(":id/registrations/:registrationId/review")
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  reviewEvidence(
    @Param("id") id: string,
    @Param("registrationId") registrationId: string,
    @Body() dto: ReviewEventEvidenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.reviewEvidence(id, registrationId, dto.approved, dto.note ?? undefined, user);
  }

  @Patch(":id/registrations/:registrationId/attendance")
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  markAttendance(
    @Param("id") id: string,
    @Param("registrationId") registrationId: string,
    @Body() dto: SetAttendanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.setAttendance(id, registrationId, dto.attended, user);
  }

  @Delete(":id/registrations/:registrationId")
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(...REVIEWER_ROLES)
  unregister(
    @Param("id") id: string,
    @Param("registrationId") registrationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.unregister(id, registrationId, user);
  }
}
