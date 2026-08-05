import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "@nmms/shared";
import type { FastifyRequest } from "fastify";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthUser }>();
  return request.user;
});
