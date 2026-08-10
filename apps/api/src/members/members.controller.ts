import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role, type AuthUser } from "@nmms/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateMemberDto } from "./dto/create-member.dto";
import { DedupeCheckDto } from "./dto/dedupe-check.dto";
import { PromoteToExecutiveDto } from "./dto/promote-to-executive.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { MembersService } from "./members.service";

const CAN_CLAIM = [Role.FIELD_EXECUTIVE, Role.ADMIN, Role.SUPER_ADMIN] as const;
const CAN_PROMOTE = [Role.ADMIN, Role.SUPER_ADMIN] as const;

@ApiTags("members")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.membersService.findAll(user);
  }

  // Declared before ":id" so "dedupe-check"/"search-referrer"/
  // "unclaimed-referrals" aren't swallowed as an id param.
  @Get("dedupe-check")
  dedupeCheck(@Query() query: DedupeCheckDto, @CurrentUser() user: AuthUser) {
    return this.membersService.dedupeCheck(query.mobile, query.aadhaarNumber, user.organizationId);
  }

  @Get("search-referrer")
  searchReferrer(@Query("q") q: string, @CurrentUser() user: AuthUser) {
    return this.membersService.searchReferrer(q ?? "", user.organizationId);
  }

  @Get("unclaimed-referrals")
  @UseGuards(RolesGuard)
  @Roles(...CAN_CLAIM)
  unclaimedReferrals(@CurrentUser() user: AuthUser) {
    return this.membersService.findUnclaimedReferrals(user.organizationId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.membersService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthUser) {
    return this.membersService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: AuthUser) {
    return this.membersService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.membersService.remove(id, user);
  }

  @Post(":id/submit")
  submit(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.membersService.submit(id, user);
  }

  @Post(":id/claim")
  @UseGuards(RolesGuard)
  @Roles(...CAN_CLAIM)
  claim(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.membersService.claim(id, user);
  }

  @Post(":id/promote-to-executive")
  @UseGuards(RolesGuard)
  @Roles(...CAN_PROMOTE)
  promoteToExecutive(
    @Param("id") id: string,
    @Body() dto: PromoteToExecutiveDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membersService.promoteToExecutive(id, dto, user);
  }
}
