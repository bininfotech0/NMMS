import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Role, type AuthUser } from "@nmms/shared";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Roles } from "./decorators/roles.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import { RolesGuard } from "./guards/roles.guard";

const REFRESH_COOKIE = "refresh_token";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  // Stricter than the global 100/60s throttle — login is a credential-guessing
  // target and deserves its own tight limit regardless of other API traffic.
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    try {
      const user = await this.authService.validateCredentials(dto.email, dto.password);
      const tokens = await this.authService.issueTokens(user);
      this.setRefreshCookie(res, tokens.refreshToken);
      void this.auditService.log({
        organizationId: user.organizationId,
        actorId: user.id,
        actorEmail: user.email,
        action: "LOGIN_SUCCESS",
        entity: "Auth",
        ipAddress: req.ip,
      });
      return { accessToken: tokens.accessToken, user };
    } catch (err) {
      void this.auditService.log({
        actorEmail: dto.email,
        action: "LOGIN_FAILED",
        entity: "Auth",
        ipAddress: req.ip,
      });
      throw err;
    }
  }

  @Post("refresh")
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @Req() req: FastifyRequest & { user: { id: string } },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const user = await this.authService.getAuthUserById(req.user.id);
    const tokens = await this.authService.issueTokens(user);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    return { success: true };
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOkResponse({ description: "The authenticated user" })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  // Sample role-gated endpoint demonstrating RBAC enforcement (Sprint 0 exit criteria).
  @Get("admin-check")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  adminCheck(@CurrentUser() user: AuthUser) {
    return { ok: true, checkedAs: user.role };
  }

  private setRefreshCookie(res: FastifyReply, refreshToken: string) {
    res.setCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
}
