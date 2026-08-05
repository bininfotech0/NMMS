import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type JwtFromRequestFunction } from "passport-jwt";
import type { FastifyRequest } from "fastify";

interface RefreshTokenPayload {
  sub: string;
}

// passport-jwt's types assume an Express Request; Nest's Fastify adapter passes
// the FastifyRequest through untouched at runtime, so we cast at the boundary.
const extractFromCookie: JwtFromRequestFunction = (req) => {
  const request = req as unknown as FastifyRequest;
  return request.cookies?.["refresh_token"] ?? null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    });
  }

  validate(payload: RefreshTokenPayload): { id: string } {
    return { id: payload.sub };
  }
}
