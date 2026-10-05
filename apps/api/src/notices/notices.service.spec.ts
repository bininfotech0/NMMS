import { NoticesService } from "./notices.service";

describe("NoticesService.getForMembers", () => {
  it("returns only published notices for everyone or members, without staff details", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new NoticesService({ notice: { findMany } } as never);

    await service.getForMembers("org-1");

    expect(findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        publishedAt: { not: null },
        OR: [{ audienceRole: "MEMBER" }, { audienceRole: null }],
      },
      select: { id: true, title: true, body: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });
  });
});
