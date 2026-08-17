import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuditLogFacets, AuditLogListQuery, AuditLogResponse } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { paginate, type PaginatedResult } from "../common/dto/pagination.dto";

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Best-effort: a failure to write an audit entry must never fail the
  // request it's auditing.
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log: ${(err as Error).message} | entry=${JSON.stringify(entry)}`,
      );
    }
  }

  async findAll(
    organizationId: string,
    query: AuditLogListQuery,
  ): Promise<PaginatedResult<AuditLogResponse>> {
    const { page, limit, search, action, entity } = query;
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
      ...(search
        ? {
            OR: [
              { actorEmail: { contains: search, mode: "insensitive" } },
              { action: { contains: search, mode: "insensitive" } },
              { entity: { contains: search, mode: "insensitive" } },
              { entityId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(logs.map(this.toResponse), total, page, limit);
  }

  // Distinct action/entity values across the org's whole audit history, not
  // just the current page — backs the filter dropdowns in the admin UI.
  async facets(organizationId: string): Promise<AuditLogFacets> {
    const [actions, entities] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId },
        distinct: ["entity"],
        select: { entity: true },
        orderBy: { entity: "asc" },
      }),
    ]);
    return { actions: actions.map((a) => a.action), entities: entities.map((e) => e.entity) };
  }

  private toResponse(log: {
    id: string;
    actorId: string | null;
    actorEmail: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    ipAddress: string | null;
    createdAt: Date;
  }): AuditLogResponse {
    return {
      id: log.id,
      actorId: log.actorId,
      actorEmail: log.actorEmail,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    };
  }
}
