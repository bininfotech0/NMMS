import { ConflictException } from "@nestjs/common";
import { IntegrationsService } from "./integrations.service";
import { makeMockPrisma } from "../test/fixtures";

// Identity encrypt/decrypt — these tests exercise IntegrationsService's
// merge/mode-switch logic, not CryptoService's actual AES-GCM correctness
// (that's CryptoService's own concern, untested elsewhere in this repo either).
function makeCrypto() {
  return {
    encrypt: jest.fn((plaintext: string) => plaintext),
    decrypt: jest.fn((payload: string) => payload),
  };
}

function makeService(prisma: ReturnType<typeof makeMockPrisma>) {
  const crypto = makeCrypto();
  const service = new IntegrationsService(prisma as never, crypto as never);
  return { service, crypto };
}

function storedConfig(config: Record<string, unknown> | null) {
  return { configEncrypted: config ? JSON.stringify(config) : null };
}

describe("IntegrationsService — Payment Gateway test/live credentials", () => {
  describe("getPaymentGatewayCredentialsStatus", () => {
    it("defaults to test mode with nothing configured when no flag row exists", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.featureFlag.findUnique.mockResolvedValue(null);

      const status = await service.getPaymentGatewayCredentialsStatus("org-1");

      expect(status).toEqual({ mode: "test", hasTestConfig: false, hasLiveConfig: false });
    });

    it("reports which modes have credentials saved without exposing the secrets", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.featureFlag.findUnique.mockResolvedValue(
        storedConfig({
          mode: "live",
          test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" },
          live: { keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" },
        }),
      );

      const status = await service.getPaymentGatewayCredentialsStatus("org-1");

      expect(status).toEqual({ mode: "live", hasTestConfig: true, hasLiveConfig: true });
    });
  });

  describe("updatePaymentGatewayCredentials", () => {
    it("saving live credentials does not wipe previously-saved test credentials", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.featureFlag.findUnique
        .mockResolvedValueOnce(
          storedConfig({ mode: "test", test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" } }),
        )
        .mockResolvedValueOnce(
          storedConfig({
            mode: "test",
            test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" },
            live: { keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" },
          }),
        );
      prisma.featureFlag.upsert.mockResolvedValue({ key: "PAYMENT_GATEWAY", enabled: false, configEncrypted: "x" });

      await service.updatePaymentGatewayCredentials(
        "live",
        { keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" },
        "org-1",
      );

      const savedConfig = JSON.parse(prisma.featureFlag.upsert.mock.calls[0][0].update.configEncrypted);
      expect(savedConfig.test).toEqual({ keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" });
      expect(savedConfig.live).toEqual({ keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" });
      // Saving credentials never changes which mode is active on its own.
      expect(savedConfig.mode).toBe("test");
    });

    it("first-ever save (no existing config) defaults the active mode to whichever mode was just saved", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      prisma.featureFlag.upsert.mockResolvedValue({ key: "PAYMENT_GATEWAY", enabled: false, configEncrypted: "x" });

      await service.updatePaymentGatewayCredentials(
        "test",
        { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" },
        "org-1",
      );

      const savedConfig = JSON.parse(prisma.featureFlag.upsert.mock.calls[0][0].update.configEncrypted);
      expect(savedConfig.mode).toBe("test");
      expect(savedConfig.test).toEqual({ keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" });
    });
  });

  describe("setPaymentGatewayMode", () => {
    it("refuses to switch to a mode with no credentials saved", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      prisma.featureFlag.findUnique.mockResolvedValue(
        storedConfig({ mode: "test", test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" } }),
      );

      await expect(service.setPaymentGatewayMode("live", "org-1")).rejects.toThrow(ConflictException);
      expect(prisma.featureFlag.upsert).not.toHaveBeenCalled();
    });

    it("switches the active mode when the target mode has credentials, leaving the other mode's credentials intact", async () => {
      const prisma = makeMockPrisma();
      const { service } = makeService(prisma);
      const existing = {
        mode: "test",
        test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" },
        live: { keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" },
      };
      prisma.featureFlag.findUnique
        .mockResolvedValueOnce(storedConfig(existing))
        .mockResolvedValueOnce(storedConfig({ ...existing, mode: "live" }));
      prisma.featureFlag.upsert.mockResolvedValue({ key: "PAYMENT_GATEWAY", enabled: false, configEncrypted: "x" });

      const status = await service.setPaymentGatewayMode("live", "org-1");

      const savedConfig = JSON.parse(prisma.featureFlag.upsert.mock.calls[0][0].update.configEncrypted);
      expect(savedConfig.mode).toBe("live");
      expect(savedConfig.test).toEqual(existing.test);
      expect(savedConfig.live).toEqual(existing.live);
      expect(status.mode).toBe("live");
    });
  });
});
