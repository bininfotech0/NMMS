import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthMember } from "@nmms/shared";
import type { FastifyRequest } from "fastify";

export const CurrentMember = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthMember => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthMember }>();
  return request.user;
});
