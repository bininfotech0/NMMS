import { Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthMember } from "@nmms/shared";
import { MemberAuthService } from "./member-auth.service";
import { CurrentMember } from "./decorators/current-member.decorator";
import { MemberJwtAuthGuard } from "./guards/member-jwt-auth.guard";
import { MemberJwtRefreshGuard } from "./guards/member-jwt-refresh.guard";

const MEMBER_REFRESH_COOKIE = "member_refresh_token";

@ApiTags("member-auth")
@Controller("member-auth")
export class MemberAuthController {
  constructor(
    private readonly memberAuthService: MemberAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(MemberJwtAuthGuard)
  me(@CurrentMember() member: AuthMember) {
    return member;
  }

  @Post("refresh")
  @HttpCode(200)
  @UseGuards(MemberJwtRefreshGuard)
  async refresh(
    @Req() req: FastifyRequest & { user: { id: string } },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const member = await this.memberAuthService.getAuthMemberById(req.user.id);
    const tokens = await this.memberAuthService.issueTokens(member);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, member };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie(MEMBER_REFRESH_COOKIE, { path: "/" });
    return { success: true };
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
