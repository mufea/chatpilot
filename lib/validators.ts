import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  organizationName: z.string().trim().min(2).max(80).optional(),
});

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const requestResetSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const invitationSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(["OWNER", "ADMIN", "AGENT"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  company: z.string().trim().max(80).optional(),
  message: z.string().trim().min(10).max(2000),
});

export const createChatbotSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
});

export const chatbotConfigSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  avatarUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  brandColor: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  welcomeMessage: z.string().trim().min(1).max(500),
  systemInstructions: z.string().max(8000),
  persona: z.string().trim().max(160).optional(),
  languages: z.string().trim().max(80),
  provider: z.enum(["openai", "gemini", "anthropic"]),
  model: z.string().min(1).max(80),
  temperature: z.coerce.number().min(0).max(2),
  maxResponseTokens: z.coerce.number().int().min(16).max(4096),
  historyLimit: z.coerce.number().int().min(2).max(40),
  fallbackMessage: z.string().trim().min(1).max(500),
  suggestedQuestions: z.string().max(2000),
  conversationLimit: z.string().optional(),
  collectLeads: z.string().optional(),
  humanHandoffEnabled: z.string().optional(),
  handoffMessage: z.string().trim().max(500).optional(),
  allowedDomains: z.string().max(2000),
  showSources: z.string().optional(),
  fallbackEnabled: z.string().optional(),
  fallbackProvider: z.string().optional(),
});

export const playMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().optional(),
});

export const providerKeySchema = z.object({
  provider: z.enum(["openai", "gemini", "anthropic"]),
  apiKey: z.string().trim().min(8).max(500),
});

export const providerIdSchema = z.object({
  provider: z.enum(["openai", "gemini", "anthropic"]),
});

export const knowledgeBaseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
});

export const pastedDocumentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(8).max(40000),
  faq: z.string().optional(),
});

export const urlDocumentSchema = z.object({
  url: z.string().trim().url().max(500),
  sitemap: z.string().optional(),
});

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  values?: Record<string, string>;
};
