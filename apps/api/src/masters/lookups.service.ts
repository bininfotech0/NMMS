import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateLookupInput, LookupCategory, LookupResponse, UpdateLookupInput } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, category?: LookupCategory): Promise<LookupResponse[]> {
    const lookups = await this.prisma.lookup.findMany({
      where: { organizationId, ...(category ? { category } : {}) },
      orderBy: { value: "asc" },
    });
    return lookups.map(this.toResponse);
  }

  async create(dto: CreateLookupInput, organizationId: string): Promise<LookupResponse> {
    try {
      const lookup = await this.prisma.lookup.create({
        data: { organizationId, category: dto.category, value: dto.value },
      });
      return this.toResponse(lookup);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("This value already exists in this category");
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateLookupInput, organizationId: string): Promise<LookupResponse> {
    const existing = await this.prisma.lookup.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException("Lookup value not found");
    }
    try {
      const lookup = await this.prisma.lookup.update({ where: { id }, data: dto });
      return this.toResponse(lookup);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("This value already exists in this category");
      }
      throw err;
    }
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const existing = await this.prisma.lookup.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException("Lookup value not found");
    }
    try {
      await this.prisma.lookup.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new ConflictException("This value is still in use and cannot be deleted");
      }
      throw err;
    }
  }

  private toResponse(lookup: {
    id: string;
    category: string;
    value: string;
    isActive: boolean;
  }): LookupResponse {
    return {
      id: lookup.id,
      category: lookup.category as LookupResponse["category"],
      value: lookup.value,
      isActive: lookup.isActive,
    };
  }
}
