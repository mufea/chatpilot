import type { PrismaClient } from "@prisma/client";
import { appConfig } from "@/lib/config";
import { decryptSecret, encryptSecret, parseEncryptionKey } from "@/lib/crypto";
import { AIError } from "@/lib/ai/errors";
import { isAiMockMode } from "@/lib/ai/mode";
import type { ProviderId } from "@/lib/ai/types";

export { isAiMockMode };

export function platformKey(provider: ProviderId) {
  if (provider === "mock") return "mock-key";
  const value =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : provider === "gemini"
        ? process.env.GOOGLE_GENERATIVE_AI_API_KEY
        : process.env.ANTHROPIC_API_KEY;
  return value?.trim() || null;
}

export async function resolveApiKey(
  db: PrismaClient,
  organizationId: string,
  provider: ProviderId,
) {
  if (provider === "mock" || isAiMockMode()) {
    return { apiKey: "mock-key", source: "mock" as const };
  }

  const customer = await db.aIProviderConfiguration.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });
  if (customer?.enabled && customer.encryptedApiKey) {
  const key = parseEncryptionKey(process.env.APP_ENCRYPTION_KEY ?? appConfig.encryptionKey);
  if (!key) {
    throw new AIError("missing_credentials", "Customer keys are configured but APP_ENCRYPTION_KEY is missing.", false);
  }
    return { apiKey: decryptSecret(customer.encryptedApiKey, key), source: "customer" as const };
  }

  const platform = platformKey(provider);
  if (platform) {
    return { apiKey: platform, source: "platform" as const };
  }

  throw new AIError(
    "missing_credentials",
    `No ${provider} API key is configured. Set a platform key or add an organization key.`,
    false,
  );
}

export async function saveOrganizationProviderKey(
  db: PrismaClient,
  organizationId: string,
  provider: Exclude<ProviderId, "mock">,
  apiKey: string,
) {
  const key = parseEncryptionKey(process.env.APP_ENCRYPTION_KEY ?? appConfig.encryptionKey);
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY must be a 32-byte hex value to store customer keys.");
  }
  const encryptedApiKey = encryptSecret(apiKey.trim(), key);
  await db.aIProviderConfiguration.upsert({
    where: { organizationId_provider: { organizationId, provider } },
    update: { encryptedApiKey, isPlatformManaged: false, enabled: true },
    create: {
      organizationId,
      provider,
      encryptedApiKey,
      isPlatformManaged: false,
      enabled: true,
    },
  });
}

export async function deleteOrganizationProviderKey(
  db: PrismaClient,
  organizationId: string,
  provider: Exclude<ProviderId, "mock">,
) {
  await db.aIProviderConfiguration.updateMany({
    where: { organizationId, provider },
    data: { encryptedApiKey: null, isPlatformManaged: true, enabled: false },
  });
}

export async function listOrganizationProviderStatus(db: PrismaClient, organizationId: string) {
  const rows = await db.aIProviderConfiguration.findMany({
    where: { organizationId },
  });
  return (["openai", "gemini", "anthropic"] as const).map((provider) => {
    const row = rows.find((item) => item.provider === provider);
    return {
      provider,
      hasCustomerKey: Boolean(row?.encryptedApiKey && row.enabled),
      hasPlatformKey: Boolean(platformKey(provider)),
    };
  });
}
