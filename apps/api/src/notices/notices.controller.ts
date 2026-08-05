import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { NoticesService } from "./notices.service";
import { CreateNoticeDto, UpdateNoticeDto } from "@nmms/shared";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Role, type AuthUser } from "@nmms/shared";

@ApiTags("Notices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notices")
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  @ApiOperation({ summary: "List all notices" })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("targetRole") targetRole?: string,
  ) {
    return this.noticesService.findAll(user.organizationId, targetRole);
  }

  @Get("active")
  @ApiOperation({ summary: "Get active (published) notices" })
  getActive(@CurrentUser() user: AuthUser) {
    return this.noticesService.getActive(user.organizationId, user.role);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get notice by ID" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.noticesService.findOne(id, user.organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a notice" })
  create(
    @Body() dto: CreateNoticeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.noticesService.create(dto, user.id, user.organizationId);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Update a notice" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateNoticeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.noticesService.update(id, dto, user.organizationId);
  }

  @Post(":id/publish")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Publish a notice" })
  publish(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.noticesService.publish(id, user.organizationId);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Delete a notice" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.noticesService.remove(id, user.organizationId);
  }
}
