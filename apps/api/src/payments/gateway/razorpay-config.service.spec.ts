import { ConflictException } from "@nestjs/common";
import { RazorpayConfigService } from "./razorpay-config.service";

function makeIntegrations(overrides: { isEnabled?: boolean; config?: Record<string, unknown> | null } = {}) {
  return {
    isEnabled: jest.fn().mockResolvedValue(overrides.isEnabled ?? true),
    getDecryptedConfig: jest.fn().mockResolvedValue(overrides.config ?? null),
  };
}

describe("RazorpayConfigService", () => {
  describe("getCredentials", () => {
    it("throws when the org hasn't enabled the gateway flag at all", async () => {
      const integrations = makeIntegrations({ isEnabled: false });
      const service = new RazorpayConfigService(integrations as never);

      await expect(service.getCredentials("org-1")).rejects.toThrow(ConflictException);
    });

    it("defaults to test-mode credentials when no mode has been explicitly saved", async () => {
      const integrations = makeIntegrations({
        config: { test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" } },
      });
      const service = new RazorpayConfigService(integrations as never);

      const creds = await service.getCredentials("org-1");

      expect(creds).toEqual({ keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" });
    });

    it("resolves the live-mode credentials when live is the active mode", async () => {
      const integrations = makeIntegrations({
        config: {
          mode: "live",
          test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" },
          live: { keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" },
        },
      });
      const service = new RazorpayConfigService(integrations as never);

      const creds = await service.getCredentials("org-1");

      expect(creds).toEqual({ keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" });
    });

    it("throws when the active mode has no credentials saved yet (enabled flag but live never configured)", async () => {
      const integrations = makeIntegrations({
        config: { mode: "live", test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" } },
      });
      const service = new RazorpayConfigService(integrations as never);

      await expect(service.getCredentials("org-1")).rejects.toThrow(ConflictException);
    });
  });

  describe("getWebhookSecrets", () => {
    it("returns both modes' webhook secrets when both are configured", async () => {
      const integrations = makeIntegrations({
        config: {
          mode: "test",
          test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" },
          live: { keyId: "rzp_live_1", keySecret: "s2", webhookSecret: "w2" },
        },
      });
      const service = new RazorpayConfigService(integrations as never);

      const secrets = await service.getWebhookSecrets("org-1");

      expect(secrets).toEqual(["w1", "w2"]);
    });

    it("returns only the configured mode's secret when the other mode isn't set up", async () => {
      const integrations = makeIntegrations({
        config: { mode: "test", test: { keyId: "rzp_test_1", keySecret: "s1", webhookSecret: "w1" } },
      });
      const service = new RazorpayConfigService(integrations as never);

      const secrets = await service.getWebhookSecrets("org-1");

      expect(secrets).toEqual(["w1"]);
    });

    it("returns an empty list when nothing is configured", async () => {
      const integrations = makeIntegrations({ config: null });
      const service = new RazorpayConfigService(integrations as never);

      const secrets = await service.getWebhookSecrets("org-1");

      expect(secrets).toEqual([]);
    });
  });
});
