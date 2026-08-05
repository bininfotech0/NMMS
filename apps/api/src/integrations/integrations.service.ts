import { Injectable, NotFoundException } from "@nestjs/common";
import { FeatureFlagKey } from "@prisma/client";
import type { FeatureFlagResponse, UpdateFeatureFlagInput } from "@nmms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";

const ALL_KEYS = Object.values(FeatureFlagKey);

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
