import { ConflictException, Injectable } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import type { RazorpayMode } from "@nmms/shared";
import { IntegrationsService } from "../../integrations/integrations.service";
import type { RazorpayCredentials } from "./razorpay-provider";

interface StoredRazorpayConfig {
  mode?: RazorpayMode;
  test?: Partial<RazorpayCredentials>;
  live?: Partial<RazorpayCredentials>;
}

// Resolves an org's *active-mode* Razorpay credentials — shared by
// PaymentGatewayService and DonationGatewayService (there's one Razorpay
// account per org, not a separate one per feature, so both read the same
// PAYMENT_GATEWAY flag). Each module registers its own instance of this
// service (same duplication precedent as RazorpayProvider) rather than
// importing one another, to keep PaymentsModule -> DonationsModule a
// one-directional edge (see PaymentsModule's webhook-routing comment).
@Injectable()
export class RazorpayConfigService {
  constructor(private readonly integrations: IntegrationsService) {}

  async isEnabled(organizationId: string): Promise<boolean> {
    return this.integrations.isEnabled(FeatureFlagKey.PAYMENT_GATEWAY, organizationId);
  }

  async getCredentials(organizationId: string): Promise<RazorpayCredentials> {
    const enabled = await this.isEnabled(organizationId);
    if (!enabled) {
      throw new ConflictException("Payment gateway is not configured");
    }
    const config = await this.integrations.getDecryptedConfig<StoredRazorpayConfig>(
      FeatureFlagKey.PAYMENT_GATEWAY,
      organizationId,
    );
    const mode = config?.mode ?? "test";
    const creds = config?.[mode];
    if (!creds?.keyId || !creds?.keySecret) {
      throw new ConflictException(`Payment gateway has no ${mode}-mode credentials saved`);
    }
    return { keyId: creds.keyId, keySecret: creds.keySecret, webhookSecret: creds.webhookSecret };
  }

  // Every mode's webhook secret with credentials saved — a webhook can arrive
  // from either the test or live Razorpay account regardless of which one is
  // currently active, since both post to the same org-scoped URL. Callers try
  // each returned secret against the incoming signature.
  async getWebhookSecrets(organizationId: string): Promise<string[]> {
    const config = await this.integrations.getDecryptedConfig<StoredRazorpayConfig>(
      FeatureFlagKey.PAYMENT_GATEWAY,
      organizationId,
    );
    return [config?.test?.webhookSecret, config?.live?.webhookSecret].filter((s): s is string => !!s);
  }
}
