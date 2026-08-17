import { AuditService } from "./audit.service";
import { makeMockPrisma } from "../test/fixtures";

function makeLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "log-1",
    actorId: "user-1",
    actorEmail: "admin@example.com",
    action: "UPDATE",
    entity: "Members",
    entityId: "member-1",
    ipAddress: "127.0.0.1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

describe("AuditService.findAll", () => {
  it("pages results and reports total/hasNext/hasPrev", async () => {
    const prisma = makeMockPrisma();
    const service = new AuditService(prisma as never);
    prisma.auditLog.findMany.mockResolvedValue([makeLog()]);
    prisma.auditLog.count.mockResolvedValue(250);

    const result = await service.findAll("org-1", { page: 2, limit: 50 });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1" }, skip: 50, take: 50 }),
    );
    expect(result.meta).toEqual({ total: 250, page: 2, limit: 50, totalPages: 5, hasNext: true, hasPrev: true });
  });

  it("filters by action and entity as exact WHERE clauses", async () => {
    const prisma = makeMockPrisma();
    const service = new AuditService(prisma as never);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    await service.findAll("org-1", { page: 1, limit: 50, action: "REJECT", entity: "Withdrawals" });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", action: "REJECT", entity: "Withdrawals" },
      }),
    );
  });

  it("searches across actor email, action, entity, and entity id (case-insensitive)", async () => {
    const prisma = makeMockPrisma();
    const service = new AuditService(prisma as never);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    await service.findAll("org-1", { page: 1, limit: 50, search: "ramesh" });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          OR: [
            { actorEmail: { contains: "ramesh", mode: "insensitive" } },
            { action: { contains: "ramesh", mode: "insensitive" } },
            { entity: { contains: "ramesh", mode: "insensitive" } },
            { entityId: { contains: "ramesh", mode: "insensitive" } },
          ],
        },
      }),
    );
  });
});

describe("AuditService.facets", () => {
  it("returns distinct actions and entities scoped to the org", async () => {
    const prisma = makeMockPrisma();
    const service = new AuditService(prisma as never);
    prisma.auditLog.findMany
      .mockResolvedValueOnce([{ action: "CREATE" }, { action: "UPDATE" }])
      .mockResolvedValueOnce([{ entity: "Members" }, { entity: "Withdrawals" }]);

    const result = await service.facets("org-1");

    expect(result).toEqual({ actions: ["CREATE", "UPDATE"], entities: ["Members", "Withdrawals"] });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1" }, distinct: ["action"] }),
    );
  });
});
