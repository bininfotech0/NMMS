import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FeatureFlagKey } from "@prisma/client";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UpdateFeatureFlagDto } from "./dto/update-feature-flag.dto";
import { IntegrationsService } from "./integrations.service";

@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.integrationsService.findAll(user.organizationId);
  }

  @Patch(":key")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param("key") key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrationsService.update(key as FeatureFlagKey, dto, user.organizationId);
  }
}
