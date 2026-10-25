import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("ChatPilot AI"),
  APP_URL: z.string().default("http://localhost:43180"),
  DATABASE_URL: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("cp_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  APP_ENCRYPTION_KEY: z.string().optional(),
  EMAIL_DELIVERY: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("ChatPilot AI <noreply@localhost>"),
  ALLOW_DEV_MAILBOX: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SUPER_ADMIN_EMAILS: z.string().optional(),
  AI_MOCK_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  appName: string;
  appUrl: string;
  databaseUrl?: string;
  sessionCookieName: string;
  sessionTtlDays: number;
  encryptionKey?: string;
  emailDelivery: "console" | "smtp";
  smtp: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    from: string;
  };
  allowDevMailbox: boolean;
  googleOAuthEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  superAdminEmails: string[];
  aiMockMode: boolean;
  platformKeysConfigured: {
    openai: boolean;
    gemini: boolean;
    anthropic: boolean;
  };
  billing: {
    stripeConfigured: boolean;
    stripeWebhookConfigured: boolean;
    midtransConfigured: boolean;
    midtransProduction: boolean;
  };
};

function parseEnv(): AppConfig {
  const parsed = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    APP_NAME: process.env.APP_NAME,
    APP_URL: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
    SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS,
    APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
    EMAIL_DELIVERY: process.env.EMAIL_DELIVERY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    ALLOW_DEV_MAILBOX: process.env.ALLOW_DEV_MAILBOX,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    SUPER_ADMIN_EMAILS: process.env.SUPER_ADMIN_EMAILS,
    AI_MOCK_MODE: process.env.AI_MOCK_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
    MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY,
    MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION,
  });

  const googleOAuthEnabled = Boolean(
    parsed.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_SECRET,
  );

  return {
    nodeEnv: parsed.NODE_ENV,
    appName: parsed.APP_NAME,
    appUrl: parsed.APP_URL,
    databaseUrl: parsed.DATABASE_URL,
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    sessionTtlDays: parsed.SESSION_TTL_DAYS,
    encryptionKey: parsed.APP_ENCRYPTION_KEY,
    emailDelivery: parsed.EMAIL_DELIVERY,
    smtp: {
      host: parsed.SMTP_HOST,
      port: parsed.SMTP_PORT,
      user: parsed.SMTP_USER,
      password: parsed.SMTP_PASSWORD,
      from: parsed.SMTP_FROM,
    },
    allowDevMailbox:
      parsed.ALLOW_DEV_MAILBOX && parsed.NODE_ENV !== "production",
    googleOAuthEnabled,
    googleClientId: parsed.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,
    superAdminEmails: (parsed.SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    aiMockMode: parsed.AI_MOCK_MODE,
    platformKeysConfigured: {
      openai: Boolean(parsed.OPENAI_API_KEY?.trim()),
      gemini: Boolean(parsed.GOOGLE_GENERATIVE_AI_API_KEY?.trim()),
      anthropic: Boolean(parsed.ANTHROPIC_API_KEY?.trim()),
    },
    billing: {
      stripeConfigured: Boolean(parsed.STRIPE_SECRET_KEY?.trim()),
      stripeWebhookConfigured: Boolean(parsed.STRIPE_WEBHOOK_SECRET?.trim()),
      midtransConfigured: Boolean(parsed.MIDTRANS_SERVER_KEY?.trim()),
      midtransProduction: parsed.MIDTRANS_IS_PRODUCTION,
    },
  };
}

export const appConfig = parseEnv();

export type ConfigIssue = {
  key: string;
  level: "error" | "warning";
  message: string;
};

export function collectConfigIssues(config: AppConfig = appConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (!config.databaseUrl) {
    issues.push({
      key: "DATABASE_URL",
      level: "error",
      message: "Database connection string is missing.",
    });
  }

  if (config.nodeEnv === "production" && !config.encryptionKey) {
    issues.push({
      key: "APP_ENCRYPTION_KEY",
      level: "error",
      message: "Required in production to encrypt customer credentials.",
    });
  }

  if (config.emailDelivery === "smtp") {
    if (!config.smtp.host || !config.smtp.user || !config.smtp.password) {
      issues.push({
        key: "SMTP",
        level: "error",
        message: "SMTP host, user, and password are required when EMAIL_DELIVERY=smtp.",
      });
    }
  } else if (config.nodeEnv === "production") {
    issues.push({
      key: "EMAIL_DELIVERY",
      level: "warning",
      message: "Production is using console email delivery. Verification and reset emails will not reach users.",
    });
  }

  if (config.nodeEnv === "production" && config.allowDevMailbox) {
    issues.push({
      key: "ALLOW_DEV_MAILBOX",
      level: "error",
      message: "Development mailbox cannot be enabled in production.",
    });
  }

  if (config.nodeEnv === "production" && config.aiMockMode) {
    issues.push({
      key: "AI_MOCK_MODE",
      level: "warning",
      message: "Production is using the mock adapter. Set AI_MOCK_MODE=false to call live providers.",
    });
  }

  if (
    !config.aiMockMode &&
    !config.platformKeysConfigured.openai &&
    !config.platformKeysConfigured.gemini &&
    !config.platformKeysConfigured.anthropic
  ) {
    issues.push({
      key: "AI_PROVIDER_KEYS",
      level: "warning",
      message: "No platform AI keys are set. Workspaces must add their own encrypted keys to chat.",
    });
  }

  if (config.nodeEnv === "production" && !config.billing.stripeConfigured && !config.billing.midtransConfigured) {
    issues.push({
      key: "BILLING_KEYS",
      level: "warning",
      message: "No Stripe or Midtrans server key is set. Checkout stays disabled until keys are present and webhooks are verified.",
    });
  }

  if (config.billing.stripeConfigured && !config.billing.stripeWebhookConfigured) {
    issues.push({
      key: "STRIPE_WEBHOOK_SECRET",
      level: "warning",
      message: "Stripe secret is set but STRIPE_WEBHOOK_SECRET is missing. Webhooks will be rejected.",
    });
  }

  return issues;
}
