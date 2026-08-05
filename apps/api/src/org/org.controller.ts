import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UpdateOrgDto } from "./dto/update-org.dto";
import { OrgService } from "./org.service";

@ApiTags("org")
@Controller("org")
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  // Unauthenticated: consumed by the login page and public site header/footer.
  @Get("public")
  getPublic() {
    return this.orgService.getPublic();
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: AuthUser) {
    return this.orgService.getProfile(user.organizationId);
  }

  @Patch()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Body() dto: UpdateOrgDto, @CurrentUser() user: AuthUser) {
    return this.orgService.update(user.organizationId, dto);
  }
}
