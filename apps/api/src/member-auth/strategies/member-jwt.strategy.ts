import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthMember } from "@nmms/shared";

interface MemberAccessTokenPayload {
  sub: string;
  fullName: string;
  mobile: string;
  organizationId: string;
  status: string;
  referralCode: string | null;
}

// Separate passport strategy ("member-jwt") from the staff "jwt" strategy —
// signed with MEMBER_JWT_ACCESS_SECRET, so a member token is never valid
// against staff-only routes and vice versa.
@Injectable()
export class MemberJwtStrategy extends PassportStrategy(Strategy, "member-jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("MEMBER_JWT_ACCESS_SECRET"),
    });
  }

  validate(payload: MemberAccessTokenPayload): AuthMember {
    return {
      id: payload.sub,
      fullName: payload.fullName,
      mobile: payload.mobile,
      organizationId: payload.organizationId,
      status: payload.status,
      referralCode: payload.referralCode,
    };
  }
}
