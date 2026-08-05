import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser, CreateUserInput, UpdateUserInput, UserResponse } from "@nmms/shared";
import { Role } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(organizationId: string): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    return users.map(this.toUserResponse);
  }

  async findOne(id: string, organizationId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.toUserResponse(user);
  }

  async create(dto: CreateUserInput, actingUser: AuthUser): Promise<UserResponse> {
    if (dto.role === Role.SUPER_ADMIN && actingUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Only a Super Admin can create another Super Admin");
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: await this.authService.hashPassword(dto.password),
          role: dto.role,
          organizationId: actingUser.organizationId,
        },
      });
      return this.toUserResponse(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A user with this email already exists");
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserInput, actingUser: AuthUser): Promise<UserResponse> {
    const target = await this.findOne(id, actingUser.organizationId);
    this.assertCanModifySuperAdmin(target.role, dto.role, actingUser);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return this.toUserResponse(user);
  }

  async resetPassword(id: string, newPassword: string, actingUser: AuthUser): Promise<void> {
    const target = await this.findOne(id, actingUser.organizationId);
    this.assertCanModifySuperAdmin(target.role, undefined, actingUser);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.authService.hashPassword(newPassword) },
    });
  }

  // A non-SUPER_ADMIN (i.e. an ADMIN, the only other role that can reach
  // this service) must not be able to modify an existing Super Admin account
  // — role or password — nor promote anyone to Super Admin.
  private assertCanModifySuperAdmin(
    currentRole: UserResponse["role"],
    nextRole: UserResponse["role"] | undefined,
    actingUser: AuthUser,
  ) {
    if (actingUser.role === Role.SUPER_ADMIN) return;
    if (currentRole === Role.SUPER_ADMIN || nextRole === Role.SUPER_ADMIN) {
      throw new ForbiddenException("Only a Super Admin can modify a Super Admin account");
    }
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
    isActive: boolean;
    createdAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role as UserResponse["role"],
      organizationId: user.organizationId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
