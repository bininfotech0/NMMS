import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ApplicationsService } from "./applications.service";
import { LifecycleActionDto } from "./dto/lifecycle-action.dto";
import { RejectMemberDto } from "./dto/reject-member.dto";

const REVIEWER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN] as const;
const LIFECYCLE_ROLES = REVIEWER_ROLES;
// Field Executives can also approve/reject — but only self-registered
// members they've personally claimed (see MembersService.claim). The role
// gate here just lets the request through; ApplicationsService.assertCanApprove
// enforces the "only their own claimed self-registrations" restriction.
const APPROVE_ROLES = [Role.FIELD_EXECUTIVE, ...REVIEWER_ROLES] as const;

@ApiTags("applications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // A Field Executive sees only what buildJurisdictionWhere already scopes
  // them to (members they created or claimed), so including them here is
  // safe — it's how they discover their own claimed self-registrations
  // waiting for approval.
  @Get()
  @UseGuards(RolesGuard)
  @Roles(...APPROVE_ROLES)
  queue(@CurrentUser() user: AuthUser) {
    return this.applicationsService.queue(user);
  }

  // Open to any authenticated role — a Field Executive should be able to see why
  // their own submission was rejected. MembersService.findOne enforces ownership.
  @Get(":id/history")
  history(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.applicationsService.history(id, user);
  }

  @Post(":id/approve")
  @UseGuards(RolesGuard)
  @Roles(...APPROVE_ROLES)
  approve(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.applicationsService.approve(id, user);
  }

  @Post(":id/reject")
  @UseGuards(RolesGuard)
  @Roles(...APPROVE_ROLES)
  reject(@Param("id") id: string, @Body() dto: RejectMemberDto, @CurrentUser() user: AuthUser) {
    return this.applicationsService.reject(id, dto, user);
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
