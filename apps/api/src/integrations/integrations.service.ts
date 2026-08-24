import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import type {
  FeatureFlagResponse,
  PaymentGatewayCredentialsStatus,
  RazorpayCredentialsInput,
  RazorpayMode,
  UpdateFeatureFlagInput,
} from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";

const ALL_KEYS = Object.values(FeatureFlagKey);

// The PAYMENT_GATEWAY flag's config shape — an org can hold both a test-mode
// and a live-mode credential set at once, with `mode` picking which one
// RazorpayConfigService actually uses. Declared here (rather than imported
// from payments/gateway) to keep IntegrationsModule decoupled from payments
// internals; it's the same shape by convention, not by shared type.
interface StoredRazorpayConfig {
  mode?: RazorpayMode;
  test?: RazorpayCredentialsInput;
  live?: RazorpayCredentialsInput;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async findAll(organizationId: string): Promise<FeatureFlagResponse[]> {
    await this.ensureDefaults(organizationId);
    const flags = await this.prisma.featureFlag.findMany({
      where: { organizationId },
      orderBy: { key: "asc" },
    });
    return flags.map(this.toResponse);
  }

  async update(
    key: FeatureFlagKey,
    dto: UpdateFeatureFlagInput,
    organizationId: string,
  ): Promise<FeatureFlagResponse> {
    if (!ALL_KEYS.includes(key)) {
      throw new NotFoundException(`Unknown feature flag "${key}"`);
    }

    const configEncrypted =
      dto.config === null
        ? null
        : dto.config !== undefined
          ? this.crypto.encrypt(JSON.stringify(dto.config))
          : undefined;

    const flag = await this.prisma.featureFlag.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(configEncrypted !== undefined ? { configEncrypted } : {}),
      },
      create: {
        organizationId,
        key,
        enabled: dto.enabled ?? false,
        configEncrypted: configEncrypted ?? null,
      },
    });
    return this.toResponse(flag);
  }

  // Consumed by feature-gated services once real provider adapters exist (Phase 2).
  async isEnabled(key: FeatureFlagKey, organizationId: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    return flag?.enabled ?? false;
  }

  // Decrypts and parses a flag's stored provider config (e.g. Razorpay keys).
  // Returns null if the flag doesn't exist or has no config set — callers
  // decide whether that's an error (it's never a crash).
  async getDecryptedConfig<T>(key: FeatureFlagKey, organizationId: string): Promise<T | null> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    if (!flag?.configEncrypted) return null;
    return JSON.parse(this.crypto.decrypt(flag.configEncrypted)) as T;
  }

  // Status only — never returns the secrets themselves (write-only, same
  // convention as FeatureFlagResponse.hasConfig).
  async getPaymentGatewayCredentialsStatus(organizationId: string): Promise<PaymentGatewayCredentialsStatus> {
    const config = await this.getDecryptedConfig<StoredRazorpayConfig>(
      FeatureFlagKey.PAYMENT_GATEWAY,
      organizationId,
    );
    return {
      mode: config?.mode ?? "test",
      hasTestConfig: !!(config?.test?.keyId && config?.test?.keySecret),
      hasLiveConfig: !!(config?.live?.keyId && config?.live?.keySecret),
    };
  }

  // Read-modify-write: merges into whichever mode's slot without touching the
  // other one, so saving live credentials doesn't wipe previously-saved test
  // credentials (and vice versa) — the generic `update()` above always
  // overwrites the whole config blob, which would be wrong here.
  async updatePaymentGatewayCredentials(
    mode: RazorpayMode,
    credentials: RazorpayCredentialsInput,
    organizationId: string,
  ): Promise<PaymentGatewayCredentialsStatus> {
    const existing = await this.getDecryptedConfig<StoredRazorpayConfig>(
      FeatureFlagKey.PAYMENT_GATEWAY,
      organizationId,
    );
    const merged: StoredRazorpayConfig = {
      mode: existing?.mode ?? mode,
      test: existing?.test,
      live: existing?.live,
      [mode]: credentials,
    };
    await this.update(FeatureFlagKey.PAYMENT_GATEWAY, { config: merged as Record<string, unknown> }, organizationId);
    return this.getPaymentGatewayCredentialsStatus(organizationId);
  }

  // Switches which mode's credentials RazorpayConfigService picks up for new
  // checkouts — refuses to switch to a mode with nothing saved yet, so
  // "Live" can't silently fall back to test credentials underneath a staff
  // member who thinks they just went live.
  async setPaymentGatewayMode(mode: RazorpayMode, organizationId: string): Promise<PaymentGatewayCredentialsStatus> {
    const existing = await this.getDecryptedConfig<StoredRazorpayConfig>(
      FeatureFlagKey.PAYMENT_GATEWAY,
      organizationId,
    );
    if (!existing?.[mode]?.keyId || !existing?.[mode]?.keySecret) {
      throw new ConflictException(`No ${mode}-mode credentials saved yet — add them before switching to ${mode} mode`);
    }
    const merged: StoredRazorpayConfig = { ...existing, mode };
    await this.update(FeatureFlagKey.PAYMENT_GATEWAY, { config: merged as Record<string, unknown> }, organizationId);
    return this.getPaymentGatewayCredentialsStatus(organizationId);
  }

  private async ensureDefaults(organizationId: string): Promise<void> {
    const existing = await this.prisma.featureFlag.findMany({
      where: { organizationId },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((f) => f.key));
    const missing = ALL_KEYS.filter((key) => !existingKeys.has(key));
    if (missing.length === 0) return;

    await this.prisma.featureFlag.createMany({
      data: missing.map((key) => ({ organizationId, key, enabled: false })),
    });
  }

  private toResponse(flag: {
    key: FeatureFlagKey;
    enabled: boolean;
    configEncrypted: string | null;
  }): FeatureFlagResponse {
    return {
      key: flag.key,
      enabled: flag.enabled,
      hasConfig: flag.configEncrypted !== null,
    };
  }
}
