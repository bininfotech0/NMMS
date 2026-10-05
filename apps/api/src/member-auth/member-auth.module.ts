import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { NumberingService } from "../common/numbering.service";
import { AadhaarHashService } from "../common/aadhaar-hash.service";
import { MemberAuthController } from "./member-auth.controller";
import { PublicMemberAuthController } from "./public-member-auth.controller";
import { MemberAuthService } from "./member-auth.service";
import { MemberJwtStrategy } from "./strategies/member-jwt.strategy";
import { MemberJwtRefreshStrategy } from "./strategies/member-jwt-refresh.strategy";
import { MemberPasswordResetService } from "./member-password-reset.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PassportModule, JwtModule.register({}), NotificationsModule],
  controllers: [MemberAuthController, PublicMemberAuthController],
  providers: [
    MemberAuthService,
    MemberPasswordResetService,
    MemberJwtStrategy,
    MemberJwtRefreshStrategy,
    NumberingService,
    AadhaarHashService,
  ],
  exports: [MemberAuthService],
})
export class MemberAuthModule {}
