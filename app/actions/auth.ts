"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, authenticateUser, changePassword, deleteAccount, issueVerificationToken, registerUser, requestPasswordReset, resetPassword, updateProfile, verifyEmailToken } from "@/lib/auth/service";
import { destroyCurrentSession, establishSession, getCurrentAuth } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  profileSchema,
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
  signupSchema,
  type FormState,
} from "@/lib/validators";
import { validatePasswordStrength } from "@/lib/auth/password";

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) result[key] = value;
  }
  return result;
}

async function clientKey(action: string) {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerStore.get("x-real-ip") || "local";
  return `${action}:${ip}`;
}

async function requestMeta() {
  const headerStore = await headers();
  return {
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip"),
    userAgent: headerStore.get("user-agent"),
  };
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName") || undefined,
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const passwordErrors = validatePasswordStrength(parsed.data.password);
  if (passwordErrors.length) {
    return { errors: { password: passwordErrors } };
  }

  const limit = consumeRateLimit(await clientKey("signup"), 8, 10 * 60 * 1000);
  if (!limit.allowed) {
    return { message: "Too many registration attempts. Please wait a few minutes." };
  }

  try {
    const result = await registerUser(prisma, {
      ...parsed.data,
      appUrl: appConfig.appUrl,
    });
    await establishSession({
      userId: result.user.id,
      activeOrganizationId: result.organization.id,
      ...(await requestMeta()),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: error.message };
    }
    throw error;
  }

  redirect("/verify-email");
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const limit = consumeRateLimit(await clientKey(`signin:${parsed.data.email}`), 8, 10 * 60 * 1000);
  if (!limit.allowed) {
    return { message: "Too many sign-in attempts. Please wait a few minutes." };
  }

  try {
    const user = await authenticateUser(prisma, parsed.data);
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id, organization: { deletedAt: null } },
      orderBy: { createdAt: "asc" },
    });
    await establishSession({
      userId: user.id,
      activeOrganizationId: membership?.organizationId,
      ...(await requestMeta()),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: error.message };
    }
    throw error;
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  await destroyCurrentSession();
  redirect("/");
}

export async function verifyEmailAction(token: string): Promise<FormState> {
  try {
    await verifyEmailToken(prisma, token);
    return { ok: true, message: "Your email is verified." };
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: error.message };
    }
    throw error;
  }
}

export async function resendVerificationAction(): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  if (auth.user.emailVerifiedAt) {
    return { ok: true, message: "Your email is already verified." };
  }
  const limit = consumeRateLimit(`verify:${auth.user.id}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return { message: "Please wait before requesting another verification email." };
  }
  await issueVerificationToken(prisma, auth.user.email, appConfig.appUrl);
  return { ok: true, message: "A new verification email is on its way." };
}

export async function requestResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }
  const limit = consumeRateLimit(await clientKey(`reset:${parsed.data.email}`), 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return { message: "Too many reset requests. Please wait a few minutes." };
  }
  await requestPasswordReset(prisma, parsed.data.email, appConfig.appUrl);
  return {
    ok: true,
    message: "If an account exists for that email, a reset link has been created.",
  };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }
  const passwordErrors = validatePasswordStrength(parsed.data.password);
  if (passwordErrors.length) {
    return { errors: { password: passwordErrors } };
  }
  try {
    await resetPassword(prisma, parsed.data.token, parsed.data.password);
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: error.message };
    }
    throw error;
  }
  redirect("/sign-in?reset=1");
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await updateProfile(prisma, auth.user.id, parsed.data);
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const nextPassword = String(formData.get("nextPassword") ?? "");
  const passwordErrors = validatePasswordStrength(nextPassword);
  if (passwordErrors.length) {
    return { errors: { nextPassword: passwordErrors } };
  }
  try {
    await changePassword(prisma, auth.user.id, { currentPassword, nextPassword });
    await destroyCurrentSession();
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: error.message };
    }
    throw error;
  }
  redirect("/sign-in?password=1");
}

export async function deleteAccountAction(): Promise<void> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/sign-in");
  await deleteAccount(prisma, auth.user.id);
  await destroyCurrentSession();
  redirect("/?deleted=1");
}
