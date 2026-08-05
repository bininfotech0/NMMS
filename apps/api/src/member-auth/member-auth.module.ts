import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { NumberingService } from "../common/numbering.service";
import { MemberAuthController } from "./member-auth.controller";
import { PublicMemberAuthController } from "./public-member-auth.controller";
import { MemberAuthService } from "./member-auth.service";
import { MemberJwtStrategy } from "./strategies/member-jwt.strategy";
import { MemberJwtRefreshStrategy } from "./strategies/member-jwt-refresh.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [MemberAuthController, PublicMemberAuthController],
  providers: [MemberAuthService, MemberJwtStrategy, MemberJwtRefreshStrategy, NumberingService],
  exports: [MemberAuthService],
})
export class MemberAuthModule {}
