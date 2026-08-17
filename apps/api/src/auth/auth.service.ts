import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { AuthUser } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.toAuthUser(user);
  }

  async issueTokens(user: AuthUser) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      fullName: user.fullName,
      isActive: user.isActive,
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: "15m",
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: "7d",
      },
    );
    return { accessToken, refreshToken };
  }

  async getAuthUserById(id: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User no longer exists");
    }
    return this.toAuthUser(user);
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    organizationId: string;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.email,
      role: user.role as AuthUser["role"],
      isActive: user.isActive,
      organizationId: user.organizationId,
    };
  }
}
