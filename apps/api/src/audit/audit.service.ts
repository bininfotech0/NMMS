import { Injectable, Logger } from "@nestjs/common";
import type { AuditLogResponse } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";

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
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async findAll(organizationId: string, limit = 200): Promise<AuditLogResponse[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorEmail: log.actorEmail,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));
  }
}
