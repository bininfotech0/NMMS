import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ApplicationsService } from "./applications.service";
import { LifecycleActionDto } from "./dto/lifecycle-action.dto";

const LIFECYCLE_ROLES = [Role.ADMIN, Role.SUPER_ADMIN] as const;
// Field Executives can view their own scoped registrations awaiting payment.
const QUEUE_ROLES = [Role.FIELD_EXECUTIVE, ...LIFECYCLE_ROLES] as const;

@ApiTags("applications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // A Field Executive sees only their scoped registrations awaiting payment.
  @Get()
  @UseGuards(RolesGuard)
  @Roles(...QUEUE_ROLES)
  queue(@CurrentUser() user: AuthUser) {
    return this.applicationsService.queue(user);
  }

  // Open to any authenticated role; MembersService.findOne enforces ownership.
  @Get(":id/history")
  history(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.applicationsService.history(id, user);
  }

  @Post(":id/suspend")
  @UseGuards(RolesGuard)
  @Roles(...LIFECYCLE_ROLES)
  suspend(@Param("id") id: string, @Body() dto: LifecycleActionDto, @CurrentUser() user: AuthUser) {
    return this.applicationsService.suspend(id, dto, user);
  }

  @Post(":id/reactivate")
  @UseGuards(RolesGuard)
  @Roles(...LIFECYCLE_ROLES)
  reactivate(@Param("id") id: string, @Body() dto: LifecycleActionDto, @CurrentUser() user: AuthUser) {
    return this.applicationsService.reactivate(id, dto, user);
  }

  @Post(":id/mark-deceased")
  @UseGuards(RolesGuard)
  @Roles(...LIFECYCLE_ROLES)
  markDeceased(@Param("id") id: string, @Body() dto: LifecycleActionDto, @CurrentUser() user: AuthUser) {
    return this.applicationsService.markDeceased(id, dto, user);
  }
}
