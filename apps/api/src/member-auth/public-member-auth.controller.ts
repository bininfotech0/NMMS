import { Body, Controller, Get, HttpCode, Post, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { MemberAuthService } from "./member-auth.service";
import { MemberRegisterDto } from "./dto/member-register.dto";
import { MemberLoginDto } from "./dto/member-login.dto";

const MEMBER_REFRESH_COOKIE = "member_refresh_token";

// No JwtAuthGuard of any kind — reachable by anyone with the /join link or
// the member login page. Same tight-throttle precedent as AuthController.login.
@ApiTags("member-auth")
@Controller("public/member-auth")
export class PublicMemberAuthController {
  constructor(
    private readonly memberAuthService: MemberAuthService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("register")
  @HttpCode(200)
  async register(@Body() dto: MemberRegisterDto, @Res({ passthrough: true }) res: FastifyReply) {
    const member = await this.memberAuthService.register(dto);
    const tokens = await this.memberAuthService.issueTokens(member);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, member };
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: MemberLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    const member = await this.memberAuthService.validateCredentials(dto.mobile, dto.password);
    const tokens = await this.memberAuthService.issueTokens(member);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, member };
  }

  @Get("resolve-code")
  resolveCode(@Query("code") code: string) {
    return this.memberAuthService.resolveReferralCode(code);
  }

  private setRefreshCookie(res: FastifyReply, refreshToken: string) {
    res.setCookie(MEMBER_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}
