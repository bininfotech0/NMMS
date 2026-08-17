import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { decimal, makeAuthUser, makeMember, makeMockPrisma } from "../test/fixtures";

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  const numbering = { nextReceiptNumber: jest.fn().mockResolvedValue("RCPT-2026-00001") };
  const membersService = { findOne: jest.fn() };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new PaymentsService(
    prisma as never,
    numbering as never,
    membersService as never,
    notifications as never,
  );
  return { service, numbering, membersService, notifications };
}

const monthsPlan = { validityType: "MONTHS", validityMonths: 12, fee: decimal(500) };

describe("PaymentsService.recordPayment", () => {
  it("collects the initial fee: DRAFT → PAYMENT_COLLECTED, sets joiningDate, notifies", async () => {
    const prisma = makeMockPrisma();
    const { service, notifications } = makeService(prisma);
    const draft = makeMember({ status: "DRAFT", plan: monthsPlan, joiningDate: null });
    prisma.member.findFirst.mockResolvedValue(draft);
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-1",
      memberId: "member-1",
      amount: decimal(500),
      mode: "CASH",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: null,
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
    });

    const user = makeAuthUser();
    const result = await service.recordPayment("member-1", { amount: 500, mode: "CASH" }, user);

    expect(result.amount).toBe(500);
    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: "member-1", status: "DRAFT" },
      data: expect.objectContaining({ status: "PAYMENT_COLLECTED" }),
    });
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "DRAFT", toStatus: "PAYMENT_COLLECTED", actorId: user.id },
    });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: "PAYMENT_RECEIPT" }));
    // A renewal payment must never fire for the initial-fee branch.
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("records a renewal payment for an ACTIVE member: CAS'd back to ACTIVE, extends validUntil, records RENEWED audit trail, no notify", async () => {
    const prisma = makeMockPrisma();
    const { service, notifications } = makeService(prisma);
    const active = makeMember({ status: "ACTIVE", plan: monthsPlan });
    prisma.member.findFirst.mockResolvedValue(active);
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-2",
      memberId: "member-1",
      amount: decimal(500),
      mode: "UPI",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: "UPI123",
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
    });

    const user = makeAuthUser();
    await service.recordPayment("member-1", { amount: 500, mode: "UPI", transactionNumber: "UPI123" }, user);

    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: "member-1", status: "ACTIVE" },
      data: { status: "ACTIVE", validUntil: expect.any(Date) },
    });
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "ACTIVE", toStatus: "RENEWED", actorId: user.id },
    });
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "RENEWED", toStatus: "ACTIVE", actorId: user.id },
    });
    expect(notifications.notify).not.toHaveBeenCalled();
    // The old direct-update path must not fire for a renewal.
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("renews a lapsed EXPIRED member back to ACTIVE", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const expired = makeMember({ status: "EXPIRED", plan: monthsPlan });
    prisma.member.findFirst.mockResolvedValue(expired);
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-4",
      memberId: "member-1",
      amount: decimal(500),
      mode: "CASH",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: null,
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
    });

    const user = makeAuthUser();
    await service.recordPayment("member-1", { amount: 500, mode: "CASH" }, user);

    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: "member-1", status: "EXPIRED" },
      data: { status: "ACTIVE", validUntil: expect.any(Date) },
    });
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "EXPIRED", toStatus: "RENEWED", actorId: user.id },
    });
    expect(prisma.statusHistory.create).toHaveBeenCalledWith({
      data: { memberId: "member-1", fromStatus: "RENEWED", toStatus: "ACTIVE", actorId: user.id },
    });
  });

  it("throws a ConflictException if the member's status changed before the renewal CAS lands", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const active = makeMember({ status: "ACTIVE", plan: monthsPlan });
    prisma.member.findFirst.mockResolvedValue(active);
    prisma.member.updateMany.mockResolvedValue({ count: 0 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-5",
      memberId: "member-1",
      amount: decimal(500),
      mode: "CASH",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: null,
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
    });

    await expect(
      service.recordPayment("member-1", { amount: 500, mode: "CASH" }, makeAuthUser()),
    ).rejects.toThrow(ConflictException);
  });

  it("gives a LIFETIME plan renewal a null validUntil", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const active = makeMember({ status: "ACTIVE", plan: { validityType: "LIFETIME", validityMonths: null, fee: decimal(1000) } });
    prisma.member.findFirst.mockResolvedValue(active);
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-3",
      memberId: "member-1",
      amount: decimal(1000),
      mode: "CASH",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: null,
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
    });

    await service.recordPayment("member-1", { amount: 1000, mode: "CASH" }, makeAuthUser());
    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: "member-1", status: "ACTIVE" },
      data: { status: "ACTIVE", validUntil: null },
    });
  });

  it("404s when the member doesn't exist or is out of the caller's scope", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.recordPayment("member-1", { amount: 500, mode: "CASH" }, makeAuthUser())).rejects.toThrow(
      NotFoundException,
    );
  });

  it("refuses a manual payment whose amount doesn't match the member's fee (₹1 registration blocked)", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT", plan: monthsPlan }));

    await expect(service.recordPayment("member-1", { amount: 1, mode: "CASH" }, makeAuthUser())).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });

  it("honors a feeOverride as the expected manual amount", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(
      makeMember({ status: "DRAFT", plan: monthsPlan, feeOverride: decimal(450) }),
    );
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-override-1",
      memberId: "member-1",
      amount: decimal(450),
      mode: "CASH",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: null,
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
    });

    const result = await service.recordPayment("member-1", { amount: 450, mode: "CASH" }, makeAuthUser());
    expect(result.amount).toBe(450);
  });

  it.each(["SUBMITTED", "APPROVED", "REJECTED", "SUSPENDED", "DECEASED"])(
    "refuses to record a payment for a %s member",
    async (status) => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.member.findFirst.mockResolvedValue(makeMember({ status, plan: monthsPlan }));
      await expect(
        service.recordPayment("member-1", { amount: 500, mode: "CASH" }, makeAuthUser()),
      ).rejects.toThrow(ConflictException);
    },
  );

  it("refuses to record a payment when no plan is assigned yet", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT", plan: null }));
    await expect(service.recordPayment("member-1", { amount: 500, mode: "CASH" }, makeAuthUser())).rejects.toThrow(
      ConflictException,
    );
  });

  it("loses a concurrent double-payment race cleanly via the CAS guard, without creating a payment row", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT", plan: monthsPlan }));
    // Another request already flipped DRAFT → PAYMENT_COLLECTED first.
    prisma.member.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.recordPayment("member-1", { amount: 500, mode: "CASH" }, makeAuthUser())).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe("PaymentsService.recordGatewayPayment", () => {
  it("records a Razorpay payment with mode ONLINE and the gateway ids, DRAFT → PAYMENT_COLLECTED", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.payment.findUnique.mockResolvedValue(null); // no existing record yet
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT", plan: monthsPlan }));
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-online-1",
      memberId: "member-1",
      amount: decimal(500),
      mode: "ONLINE",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: "pay_XYZ",
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
      gatewayOrderId: "order_ABC",
      gatewayPaymentId: "pay_XYZ",
    });

    const user = makeAuthUser();
    const result = await service.recordGatewayPayment(
      "member-1",
      { orderId: "order_ABC", paymentId: "pay_XYZ", amount: 500 },
      user,
    );

    expect(result.mode).toBe("ONLINE");
    expect(result.gatewayPaymentId).toBe("pay_XYZ");
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: "ONLINE",
          gatewayOrderId: "order_ABC",
          gatewayPaymentId: "pay_XYZ",
          receivedById: user.id,
        }),
      }),
    );
  });

  it("is idempotent: a second call with the same paymentId returns the existing row without creating a duplicate", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    const existing = {
      id: "payment-online-1",
      memberId: "member-1",
      amount: decimal(500),
      mode: "ONLINE",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: "pay_XYZ",
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
      gatewayOrderId: "order_ABC",
      gatewayPaymentId: "pay_XYZ",
    };
    prisma.payment.findUnique.mockResolvedValue(existing);

    const result = await service.recordGatewayPayment(
      "member-1",
      { orderId: "order_ABC", paymentId: "pay_XYZ", amount: 500 },
      makeAuthUser(),
    );

    expect(result.id).toBe("payment-online-1");
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("recovers from a concurrent double-write race (P2002) by returning the winner's row", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    // Idempotency check passes (no row yet)...
    prisma.payment.findUnique.mockResolvedValueOnce(null);
    prisma.member.findFirst.mockResolvedValue(makeMember({ status: "DRAFT", plan: monthsPlan }));
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    // ...but another concurrent request (verify callback vs webhook) won the insert.
    prisma.payment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const winner = {
      id: "payment-online-1",
      memberId: "member-1",
      amount: decimal(500),
      mode: "ONLINE",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: "pay_XYZ",
      remarks: null,
      receivedById: "user-1",
      paidAt: new Date(),
      gatewayOrderId: "order_ABC",
      gatewayPaymentId: "pay_XYZ",
    };
    prisma.payment.findUnique.mockResolvedValueOnce(winner);

    const result = await service.recordGatewayPayment(
      "member-1",
      { orderId: "order_ABC", paymentId: "pay_XYZ", amount: 500 },
      makeAuthUser(),
    );

    expect(result.id).toBe("payment-online-1");
  });
});

describe("PaymentsService.recordGatewayPaymentFromWebhook", () => {
  it("attributes the payment to the member's createdById, since a webhook has no acting user", async () => {
    const prisma = makeMockPrisma();
    const { service } = makeService(prisma);
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.member.findFirst.mockResolvedValue(
      makeMember({ status: "DRAFT", plan: monthsPlan, createdById: "field-exec-7" }),
    );
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.create.mockResolvedValue({
      id: "payment-online-2",
      memberId: "member-1",
      amount: decimal(500),
      mode: "ONLINE",
      receiptNumber: "RCPT-2026-00001",
      transactionNumber: "pay_WEBHOOK",
      remarks: null,
      receivedById: "field-exec-7",
      paidAt: new Date(),
      gatewayOrderId: "order_WEBHOOK",
      gatewayPaymentId: "pay_WEBHOOK",
    });

    await service.recordGatewayPaymentFromWebhook(
      "member-1",
      { orderId: "order_WEBHOOK", paymentId: "pay_WEBHOOK", amount: 500 },
      "org-1",
    );

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ receivedById: "field-exec-7" }) }),
    );
  });
});
