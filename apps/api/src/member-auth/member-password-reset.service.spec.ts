import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import * as argon2 from "argon2";
import { createHmac } from "crypto";
import { MemberPasswordResetService, MAX_RESET_ATTEMPTS } from "./member-password-reset.service";

const SECRET = "test-secret";
const NOW = new Date("2026-10-05T10:00:00.000Z");

function hashFor(memberId: string, code: string) {
  return createHmac("sha256", SECRET).update(`${memberId}:${code}`).digest("hex");
}

function setup({ smsAvailable = true } = {}) {
  const prisma = {
    organization: { findFirst: jest.fn().mockResolvedValue({ id: "org-1" }) },
    member: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    memberPasswordReset: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const notifications = {
    isSmsAvailable: jest.fn().mockResolvedValue(smsAvailable),
    sendSmsNow: jest.fn().mockResolvedValue(true),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue(SECRET) };
  const service = new MemberPasswordResetService(prisma as never, notifications as never, config as never);
  return { service, prisma, notifications };
}

describe("MemberPasswordResetService.requestCode", () => {
  it("refuses clearly when SMS isn't set up", async () => {
    const { service } = setup({ smsAvailable: false });
    await expect(service.requestCode("9876543210", NOW)).rejects.toThrow(ServiceUnavailableException);
  });

  it("gives the same answer for an unknown number and sends nothing", async () => {
    const { service, prisma, notifications } = setup();
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(service.requestCode("9876543210", NOW)).resolves.toEqual({ sent: true });
    expect(notifications.sendSmsNow).not.toHaveBeenCalled();
    expect(prisma.memberPasswordReset.create).not.toHaveBeenCalled();
  });

  it("does not resend within the cooldown", async () => {
    const { service, prisma, notifications } = setup();
    prisma.member.findFirst.mockResolvedValue({ id: "member-1", status: "ACTIVE" });
    prisma.memberPasswordReset.findFirst.mockResolvedValue({ id: "reset-1" });

    await service.requestCode("9876543210", NOW);
    expect(notifications.sendSmsNow).not.toHaveBeenCalled();
  });

  it("stores only a hash of a 6-digit code, expires old codes, and texts the code", async () => {
    const { service, prisma, notifications } = setup();
    prisma.member.findFirst.mockResolvedValue({ id: "member-1", status: "ACTIVE" });

    await service.requestCode("9876543210", NOW);

    expect(prisma.memberPasswordReset.updateMany).toHaveBeenCalledWith({
      where: { memberId: "member-1", usedAt: null },
      data: { usedAt: NOW },
    });
    const created = prisma.memberPasswordReset.create.mock.calls[0][0].data;
    expect(created.expiresAt).toEqual(new Date(NOW.getTime() + 10 * 60 * 1000));
    const smsBody: string = notifications.sendSmsNow.mock.calls[0][2];
    const code = /\b(\d{6})\b/.exec(smsBody)?.[1];
    expect(code).toBeDefined();
    expect(created.codeHash).toBe(hashFor("member-1", code!));
    expect(created.codeHash).not.toContain(code!);
  });
});

describe("MemberPasswordResetService.confirm", () => {
  it("rejects a wrong code and counts the attempt", async () => {
    const { service, prisma } = setup();
    prisma.member.findFirst.mockResolvedValue({ id: "member-1" });
    prisma.memberPasswordReset.findFirst.mockResolvedValue({ id: "reset-1", attempts: 0, codeHash: hashFor("member-1", "123456") });

    await expect(service.confirm("9876543210", "000000", "newpassword1", NOW)).rejects.toThrow(/not right/);
    expect(prisma.memberPasswordReset.update).toHaveBeenCalledWith({
      where: { id: "reset-1" },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("stops accepting a code after too many wrong tries", async () => {
    const { service, prisma } = setup();
    prisma.member.findFirst.mockResolvedValue({ id: "member-1" });
    prisma.memberPasswordReset.findFirst.mockResolvedValue({
      id: "reset-1",
      attempts: MAX_RESET_ATTEMPTS,
      codeHash: hashFor("member-1", "123456"),
    });

    await expect(service.confirm("9876543210", "123456", "newpassword1", NOW)).rejects.toThrow(BadRequestException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("sets the new password once with the right code", async () => {
    const { service, prisma } = setup();
    prisma.member.findFirst.mockResolvedValue({ id: "member-1" });
    prisma.memberPasswordReset.findFirst.mockResolvedValue({ id: "reset-1", attempts: 1, codeHash: hashFor("member-1", "123456") });

    await expect(service.confirm("9876543210", "123456", "newpassword1", NOW)).resolves.toEqual({ reset: true });

    expect(prisma.memberPasswordReset.updateMany).toHaveBeenCalledWith({
      where: { id: "reset-1", usedAt: null },
      data: { usedAt: NOW },
    });
    const { passwordHash } = prisma.member.update.mock.calls[0][0].data;
    expect(await argon2.verify(passwordHash, "newpassword1")).toBe(true);
  });

  it("rejects when there is no valid code", async () => {
    const { service, prisma } = setup();
    prisma.member.findFirst.mockResolvedValue({ id: "member-1" });
    prisma.memberPasswordReset.findFirst.mockResolvedValue(null);

    await expect(service.confirm("9876543210", "123456", "newpassword1", NOW)).rejects.toThrow(/expired/);
  });
});
