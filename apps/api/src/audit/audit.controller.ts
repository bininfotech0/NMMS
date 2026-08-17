import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuditService } from "./audit.service";
import { AuditLogListQueryDto } from "./dto/audit-log-list-query.dto";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // Declared before ":id"-shaped routes would go, matching this codebase's
  // convention — there's no ":id" route on this controller today, but this
  // keeps the ordering safe if one is ever added.
  @Get("facets")
  facets(@CurrentUser() user: AuthUser) {
    return this.auditService.facets(user.organizationId);
  }

  @Get()
  findAll(@Query() query: AuditLogListQueryDto, @CurrentUser() user: AuthUser) {
    return this.auditService.findAll(user.organizationId, query);
  }
}
