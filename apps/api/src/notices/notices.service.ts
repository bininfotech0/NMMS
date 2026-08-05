import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateNoticeDto, UpdateNoticeDto } from "@nmms/shared";

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, targetRole?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (targetRole) {
      where.audienceRole = targetRole;
    }
    return this.prisma.notice.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { createdBy: { select: { id: true, email: true } } },
    });
  }

  async findOne(id: string, organizationId: string) {
    const notice = await this.prisma.notice.findFirst({
      where: { id, organizationId },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!notice) throw new NotFoundException("Notice not found");
    return notice;
  }

  async create(dto: CreateNoticeDto, userId: string, organizationId: string) {
    return this.prisma.notice.create({
      data: {
        title: dto.title,
        body: dto.body,
        audienceRole: dto.audienceRole ?? null,
        publishedAt: dto.publishNow ? new Date() : null,
        createdById: userId,
        organizationId,
      },
    });
  }

  async update(id: string, dto: UpdateNoticeDto, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.notice.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        audienceRole: dto.audienceRole ?? null,
        publishedAt: dto.publishNow ? new Date() : undefined,
      },
    });
  }

  async publish(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.notice.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.notice.delete({ where: { id } });
  }

  async getActive(organizationId: string, targetRole?: string) {
    return this.prisma.notice.findMany({
      where: {
        organizationId,
        publishedAt: { not: null },
        ...(targetRole ? { OR: [{ audienceRole: targetRole }, { audienceRole: null }] } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: 10,
    });
  }
}
