import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class MemberJwtRefreshGuard extends AuthGuard("member-jwt-refresh") {}
