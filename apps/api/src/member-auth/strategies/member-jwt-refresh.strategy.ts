import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type JwtFromRequestFunction } from "passport-jwt";
import type { FastifyRequest } from "fastify";

interface MemberRefreshTokenPayload {
  sub: string;
}

// Separate cookie name from the staff "refresh_token" cookie so both a staff
// session and a member session can coexist in the same browser without
// clobbering each other.
const extractFromCookie: JwtFromRequestFunction = (req) => {
  const request = req as unknown as FastifyRequest;
  return request.cookies?.["member_refresh_token"] ?? null;
};

@Injectable()
export class MemberJwtRefreshStrategy extends PassportStrategy(Strategy, "member-jwt-refresh") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("MEMBER_JWT_REFRESH_SECRET"),
    });
  }

  validate(payload: MemberRefreshTokenPayload): { id: string } {
    return { id: payload.sub };
  }
}
