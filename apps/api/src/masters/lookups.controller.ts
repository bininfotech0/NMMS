import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role, type AuthUser, type LookupCategory } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateLookupDto, UpdateLookupDto } from "./dto/lookup.dto";
import { LookupsService } from "./lookups.service";

@ApiTags("masters")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("masters/lookups")
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get()
  findAll(@Query("category") category: LookupCategory | undefined, @CurrentUser() user: AuthUser) {
    return this.lookupsService.findAll(user.organizationId, category);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateLookupDto, @CurrentUser() user: AuthUser) {
    return this.lookupsService.create(dto, user.organizationId);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateLookupDto, @CurrentUser() user: AuthUser) {
    return this.lookupsService.update(id, dto, user.organizationId);
  }

  @Delete(":id")
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.lookupsService.remove(id, user.organizationId);
  }
}
