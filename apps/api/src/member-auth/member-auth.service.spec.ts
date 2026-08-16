import * as argon2 from "argon2";
import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { MemberAuthService } from "./member-auth.service";
import { makeMember, makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  const jwt = { signAsync: jest.fn().mockResolvedValue("signed-token") };
  const config = { getOrThrow: jest.fn().mockReturnValue("secret") };
  const numbering = { nextRegistrationNumber: jest.fn().mockResolvedValue("REG-2026-00099") };
  const aadhaar = { hash: jest.fn().mockReturnValue("hashed-aadhaar"), last4: jest.fn().mockReturnValue("1234") };
  const service = new MemberAuthService(
    prisma as never,
    jwt as never,
    config as never,
    numbering as never,
    aadhaar as never,
  );
  return { service, jwt, config, numbering, aadhaar };
}

describe("MemberAuthService", () => {
  describe("register", () => {
    it("creates a DRAFT member attributed to a lazily-created system user", async () => {
      const prisma = makeMockPrisma();
      const { service, numbering } = makeService(prisma);
      prisma.organization.findFirst.mockResolvedValue({ id: "org-1" });
      prisma.member.findFirst.mockResolvedValue(null); // no existing portal account
      prisma.user.findUnique.mockResolvedValue(null); // system user doesn't exist yet
      prisma.user.create.mockResolvedValue({ id: "system-user-1" });
      prisma.member.create.mockResolvedValue(
        makeMember({ id: "member-1", fullName: "New Member", mobile: "9800000001", status: "DRAFT" }),
      );

      const member = await service.register({ fullName: "New Member", mobile: "9800000001", aadhaarNumber: "123456789012", password: "Passw0rd!" });

      expect(member.status).toBe("DRAFT");
      expect(numbering.nextRegistrationNumber).toHaveBeenCalledWith("org-1");
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, isSystem: true, organizationId: "org-1" }),
        }),
      );
      expect(prisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: "system-user-1",
            fullName: "New Member",
            mobile: "9800000001",
          }),
        }),
      );
    });

    it("hashes the Aadhaar number and stores its last 4 digits", async () => {
      const prisma = makeMockPrisma();
      const { service, aadhaar } = makeService(prisma);
      prisma.organization.findFirst.mockResolvedValue({ id: "org-1" });
      prisma.member.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: "system-user-1" });
      prisma.member.create.mockResolvedValue(makeMember({ status: "DRAFT" }));

      await service.register({
        fullName: "New Member",
        mobile: "9800000001",
        aadhaarNumber: "123456789012",
        password: "Passw0rd!",
      });

      expect(aadhaar.hash).toHaveBeenCalledWith("123456789012");
      expect(aadhaar.last4).toHaveBeenCalledWith("123456789012");
      expect(prisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ aadhaarHash: "hashed-aadhaar", aadhaarLast4: "1234" }),
        }),
      );
    });

    it("persists an optional email when provided, or null when omitted", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.organization.findFirst.mockResolvedValue({ id: "org-1" });
      prisma.member.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: "system-user-1" });
      prisma.member.create.mockResolvedValue(makeMember({ status: "DRAFT" }));

      await service.register({
        fullName: "New Member",
        mobile: "9800000001",
        aadhaarNumber: "123456789012",
        email: "new@member.test",
        password: "Passw0rd!",
      });
      expect(prisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: "new@member.test" }) }),
      );

      await service.register({
        fullName: "New Member",
        mobile: "9800000002",
        aadhaarNumber: "123456789013",
        password: "Passw0rd!",
      });
      expect(prisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: null }) }),
      );
    });

    it("reuses an existing system user instead of creating a duplicate", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.organization.findFirst.mockResolvedValue({ id: "org-1" });
      prisma.member.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: "existing-system-user" });
      prisma.member.create.mockResolvedValue(makeMember({ status: "DRAFT" }));

      await service.register({ fullName: "New Member", mobile: "9800000001", aadhaarNumber: "123456789012", password: "Passw0rd!" });

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdById: "existing-system-user" }) }),
      );
    });

    it("rejects a mobile number that already has a portal account", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.organization.findFirst.mockResolvedValue({ id: "org-1" });
      prisma.member.findFirst.mockResolvedValue(makeMember({ passwordHash: "already-set" }));

      await expect(
        service.register({ fullName: "New Member", mobile: "9800000001", aadhaarNumber: "123456789012", password: "Passw0rd!" }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.member.create).not.toHaveBeenCalled();
    });

    it("resolves a referral code to the referrer's member id", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.organization.findFirst.mockResolvedValue({ id: "org-1" });
      prisma.member.findFirst
        .mockResolvedValueOnce(null) // dedupe check
        .mockResolvedValueOnce(makeMember({ id: "referrer-1", referralCode: "ABCD1234" })); // referral code lookup
      prisma.user.findUnique.mockResolvedValue({ id: "system-user-1" });
      prisma.member.create.mockResolvedValue(makeMember({ status: "DRAFT" }));

      await service.register({
        fullName: "New Member",
        mobile: "9800000001",
        aadhaarNumber: "123456789012",
        password: "Passw0rd!",
        referralCode: "ABCD1234",
      });

      expect(prisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ referralMemberId: "referrer-1" }) }),
      );
    });

    it("rejects an unknown referral code", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.organization.findFirst.mockResolvedValue({ id: "org-1" });
      prisma.member.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null); // referral code not found

      await expect(
        service.register({
          fullName: "New Member",
          mobile: "9800000001",
          aadhaarNumber: "123456789012",
          password: "Passw0rd!",
          referralCode: "NOPE0000",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("validateCredentials", () => {
    it("succeeds with the correct mobile and password", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const passwordHash = await argon2.hash("Passw0rd!");
      prisma.member.findFirst.mockResolvedValue(makeMember({ mobile: "9800000001", passwordHash }));

      const member = await service.validateCredentials("9800000001", "Passw0rd!");

      expect(member.mobile).toBe("9800000001");
    });

    it("rejects an incorrect password", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const passwordHash = await argon2.hash("Passw0rd!");
      prisma.member.findFirst.mockResolvedValue(makeMember({ mobile: "9800000001", passwordHash }));

      await expect(service.validateCredentials("9800000001", "wrong-password")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects a mobile number with no portal account", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(service.validateCredentials("9800000001", "Passw0rd!")).rejects.toThrow(UnauthorizedException);
    });
  });
});
