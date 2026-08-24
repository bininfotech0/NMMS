import { ConflictException, NotFoundException } from "@nestjs/common";
import { Role } from "@nmms/shared";
import { DonationsService } from "./donations.service";
import { decimal, makeAuthUser, makeDonation, makeMember, makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  const numbering = { nextDonationReceiptNumber: jest.fn().mockResolvedValue("DON-2026-00001") };
  const referrals = {
    recordPendingDonationPoints: jest.fn().mockResolvedValue(undefined),
    creditDonationPoints: jest.fn().mockResolvedValue(undefined),
    resolveDonation: jest.fn().mockResolvedValue(undefined),
  };
  const service = new DonationsService(prisma as never, numbering as never, referrals as never);
  return { service, numbering, referrals };
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return { organizationId: "org-1", donationPointsPercent: 10, ...overrides };
}

describe("DonationsService", () => {
  describe("submitMine", () => {
    it("creates a PENDING donation, computes points from the current org rate, and locks them into the ledger", async () => {
      const prisma = makeMockPrisma();
      const { service, referrals } = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ organizationId: "org-1" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ donationPointsPercent: 10 }));
      prisma.donation.create.mockResolvedValue(
        makeDonation({ amount: decimal(500), pointsAwarded: 50, donorAddress: "12 MG Road", donorPan: "ABCDE1234F" }),
      );

      const result = await service.submitMine("member-1", {
        amount: 500,
        mode: "CASH",
        donorAddress: "12 MG Road",
        donorPan: "ABCDE1234F",
      });

      expect(prisma.donation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: "org-1",
          memberId: "member-1",
          amount: 500,
          mode: "CASH",
          donorAddress: "12 MG Road",
          donorPan: "ABCDE1234F",
          pointsAwarded: 50,
        }),
      });
      expect(referrals.recordPendingDonationPoints).toHaveBeenCalledWith("org-1", "member-1", "donation-1", 50);
      expect(result.status).toBe("PENDING");
      expect(result.donorAddress).toBe("12 MG Road");
      expect(result.donorPan).toBe("ABCDE1234F");
    });

    it("defaults donorAddress/donorPan to null when omitted", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findUniqueOrThrow.mockResolvedValue(makeMember({ organizationId: "org-1" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ donationPointsPercent: 0 }));
      prisma.donation.create.mockResolvedValue(makeDonation({ amount: decimal(200), pointsAwarded: 0 }));

      await service.submitMine("member-1", { amount: 200, mode: "UPI" });

      expect(prisma.donation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ donorAddress: null, donorPan: null, pointsAwarded: 0 }),
      });
    });
  });

  describe("recordDirect", () => {
    it("refuses to record for a member outside the staff member's jurisdiction", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(null);
      const user = makeAuthUser({ role: Role.FIELD_EXECUTIVE });

      await expect(service.recordDirect("member-1", { amount: 500, mode: "CASH" }, user)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.donation.create).not.toHaveBeenCalled();
    });

    it("creates an immediately-APPROVED donation, allocates a receipt number, and credits points in the same transaction", async () => {
      const prisma = makeMockPrisma();
      const { service, numbering, referrals } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ organizationId: "org-1" }));
      prisma.orgSettings.upsert.mockResolvedValue(makeSettings({ donationPointsPercent: 10 }));
      prisma.donation.create.mockResolvedValue(
        makeDonation({ status: "APPROVED", receiptNumber: "DON-2026-00001", pointsAwarded: 50 }),
      );
      const user = makeAuthUser({ id: "admin-1", organizationId: "org-1" });

      const result = await service.recordDirect("member-1", { amount: 500, mode: "CASH" }, user);

      expect(numbering.nextDonationReceiptNumber).toHaveBeenCalledWith("org-1");
      expect(prisma.donation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "APPROVED",
          receiptNumber: "DON-2026-00001",
          pointsAwarded: 50,
          recordedById: "admin-1",
          reviewedById: "admin-1",
        }),
      });
      expect(referrals.creditDonationPoints).toHaveBeenCalledWith(prisma, "org-1", "member-1", 50, "donation-1");
      expect(result.status).toBe("APPROVED");
    });
  });

  describe("approve", () => {
    it("refuses to approve a donation outside the reviewer's jurisdiction (Field Executive scoping)", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      // findScoped's jurisdiction where excludes this row for a Field
      // Executive who didn't create the donor member — simulated as no match.
      prisma.donation.findFirst.mockResolvedValue(null);
      const user = makeAuthUser({ role: Role.FIELD_EXECUTIVE });

      await expect(service.approve("donation-1", "org-1", "admin-1", user)).rejects.toThrow(NotFoundException);
      expect(prisma.donation.updateMany).not.toHaveBeenCalled();
    });

    it("CAS's PENDING -> APPROVED, allocates a receipt number only after the CAS succeeds, and resolves the pending ledger row", async () => {
      const prisma = makeMockPrisma();
      const { service, numbering, referrals } = makeService(prisma);
      prisma.donation.findFirst.mockResolvedValue(makeDonation({ status: "PENDING" }));
      prisma.donation.updateMany.mockResolvedValue({ count: 1 });
      prisma.donation.update.mockResolvedValue(
        makeDonation({ status: "APPROVED", receiptNumber: "DON-2026-00001" }),
      );
      const user = makeAuthUser();

      await service.approve("donation-1", "org-1", "admin-1", user);

      expect(prisma.donation.updateMany).toHaveBeenCalledWith({
        where: { id: "donation-1", organizationId: "org-1", status: "PENDING" },
        data: expect.objectContaining({ status: "APPROVED", reviewedById: "admin-1" }),
      });
      expect(numbering.nextDonationReceiptNumber).toHaveBeenCalledWith("org-1");
      expect(referrals.resolveDonation).toHaveBeenCalledWith("org-1", "member-1", "donation-1", true);
    });

    it("refuses a double-approve race (already resolved by someone else) and does not burn a receipt number", async () => {
      const prisma = makeMockPrisma();
      const { service, numbering } = makeService(prisma);
      prisma.donation.findFirst.mockResolvedValue(makeDonation({ status: "PENDING" }));
      prisma.donation.updateMany.mockResolvedValue({ count: 0 });
      const user = makeAuthUser();

      await expect(service.approve("donation-1", "org-1", "admin-1", user)).rejects.toThrow(ConflictException);
      expect(numbering.nextDonationReceiptNumber).not.toHaveBeenCalled();
    });
  });

  describe("reject", () => {
    it("rejects a PENDING donation with a note and resolves the pending ledger row as REJECTED", async () => {
      const prisma = makeMockPrisma();
      const { service, referrals } = makeService(prisma);
      prisma.donation.findFirst.mockResolvedValue(makeDonation({ status: "PENDING" }));
      prisma.donation.updateMany.mockResolvedValue({ count: 1 });
      const user = makeAuthUser();

      await service.reject("donation-1", "org-1", "admin-1", "Could not verify receipt", user);

      expect(prisma.donation.updateMany).toHaveBeenCalledWith({
        where: { id: "donation-1", organizationId: "org-1", status: "PENDING" },
        data: expect.objectContaining({
          status: "REJECTED",
          reviewedById: "admin-1",
          reviewNote: "Could not verify receipt",
        }),
      });
      expect(referrals.resolveDonation).toHaveBeenCalledWith("org-1", "member-1", "donation-1", false);
    });

    it("refuses to reject a donation that is no longer PENDING (already approved/rejected)", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.donation.findFirst.mockResolvedValue(makeDonation({ status: "APPROVED" }));
      prisma.donation.updateMany.mockResolvedValue({ count: 0 });
      const user = makeAuthUser();

      await expect(service.reject("donation-1", "org-1", "admin-1", "note", user)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
