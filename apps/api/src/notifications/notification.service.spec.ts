import { NotificationService, type NotificationEvent } from "./notification.service";

function makeIntegrations(enabled: Partial<Record<string, boolean>> = {}) {
  return {
    isEnabled: jest.fn((key: string) => Promise.resolve(enabled[key] ?? false)),
    getDecryptedConfig: jest.fn().mockResolvedValue(null),
  };
}

function makeService(integrations: ReturnType<typeof makeIntegrations>) {
  const twilio = { sendSms: jest.fn().mockResolvedValue(undefined), sendWhatsApp: jest.fn().mockResolvedValue(undefined) };
  const resend = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const service = new NotificationService(integrations as never, twilio as never, resend as never);
  return { service, twilio, resend };
}

const paymentEvent: NotificationEvent = {
  type: "PAYMENT_RECEIPT",
  organizationId: "org-1",
  memberName: "Ramesh Kumar",
  mobile: "+919800000000",
  email: "ramesh@example.com",
  amount: 500,
  receiptNumber: "RCPT-2026-00001",
};

describe("NotificationService.notify", () => {
  it("dispatches nothing when every channel flag is disabled", async () => {
    const integrations = makeIntegrations();
    const { service, twilio, resend } = makeService(integrations);

    await service.notify(paymentEvent);

    expect(twilio.sendSms).not.toHaveBeenCalled();
    expect(twilio.sendWhatsApp).not.toHaveBeenCalled();
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it("sends SMS when the SMS flag is enabled with complete credentials", async () => {
    const integrations = makeIntegrations({ SMS: true });
    integrations.getDecryptedConfig.mockResolvedValue({
      accountSid: "AC123",
      authToken: "token",
      fromNumber: "+15551234567",
    });
    const { service, twilio, resend } = makeService(integrations);

    await service.notify(paymentEvent);

    expect(twilio.sendSms).toHaveBeenCalledWith(
      paymentEvent.mobile,
      expect.stringContaining("500"),
      { accountSid: "AC123", authToken: "token", fromNumber: "+15551234567" },
    );
    expect(twilio.sendWhatsApp).not.toHaveBeenCalled();
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it("sends WhatsApp when that flag is enabled, independent of SMS", async () => {
    const integrations = makeIntegrations({ WHATSAPP_NOTIFY: true });
    integrations.getDecryptedConfig.mockResolvedValue({
      accountSid: "AC123",
      authToken: "token",
      fromNumber: "+15551234567",
    });
    const { service, twilio } = makeService(integrations);

    await service.notify(paymentEvent);

    expect(twilio.sendWhatsApp).toHaveBeenCalled();
    expect(twilio.sendSms).not.toHaveBeenCalled();
  });

  it("sends email only when the flag is enabled and the event carries an address", async () => {
    const integrations = makeIntegrations({ EMAIL: true });
    integrations.getDecryptedConfig.mockResolvedValue({ apiKey: "re_123", fromAddress: "noreply@nmms.org" });
    const { service, resend } = makeService(integrations);

    await service.notify(paymentEvent);
    expect(resend.sendEmail).toHaveBeenCalledWith(
      "ramesh@example.com",
      expect.any(String),
      expect.any(String),
      { apiKey: "re_123", fromAddress: "noreply@nmms.org" },
    );

    resend.sendEmail.mockClear();
    await service.notify({ ...paymentEvent, email: null });
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it("skips a channel with incomplete credentials rather than dispatching partially", async () => {
    const integrations = makeIntegrations({ SMS: true });
    integrations.getDecryptedConfig.mockResolvedValue({ accountSid: "AC123" }); // missing authToken/fromNumber
    const { service, twilio } = makeService(integrations);

    await service.notify(paymentEvent);

    expect(twilio.sendSms).not.toHaveBeenCalled();
  });

  it("swallows a provider failure on one channel without throwing or blocking others", async () => {
    const integrations = makeIntegrations({ SMS: true, EMAIL: true });
    integrations.getDecryptedConfig.mockImplementation((key: string) =>
      Promise.resolve(
        key === "SMS"
          ? { accountSid: "AC123", authToken: "token", fromNumber: "+15551234567" }
          : { apiKey: "re_123", fromAddress: "noreply@nmms.org" },
      ),
    );
    const { service, twilio, resend } = makeService(integrations);
    twilio.sendSms.mockRejectedValue(new Error("Twilio down"));

    await expect(service.notify(paymentEvent)).resolves.toBeUndefined();
    expect(resend.sendEmail).toHaveBeenCalled();
  });
});
