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

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  values?: Record<string, string>;
};
