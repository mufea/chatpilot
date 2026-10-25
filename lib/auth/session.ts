import "server-only";

import { cookies } from "next/headers";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  createSession,
  getSessionUser,
  revokeSession,
  type PublicUser,
} from "@/lib/auth/service";
import { listUserOrganizations } from "@/lib/org/service";

export const AUTH_COOKIE = appConfig.sessionCookieName;

export async function readSessionToken() {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.nodeEnv === "production",
    path: "/",
    maxAge: appConfig.sessionTtlDays * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}

export async function establishSession(input: {
  userId: string;
  activeOrganizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { token } = await createSession(prisma, input);
  await setSessionCookie(token);
  return token;
}

export async function destroyCurrentSession() {
  const token = await readSessionToken();
  if (token) {
    await revokeSession(prisma, token);
  }
  await clearSessionCookie();
}

export async function getCurrentAuth() {
  const token = await readSessionToken();
  const auth = await getSessionUser(prisma, token);
  if (!auth) return null;

  const memberships = await listUserOrganizations(prisma, auth.user.id);
  const activeOrganization =
    memberships.find((item) => item.organizationId === auth.session.activeOrganizationId)
      ?.organization ?? memberships[0]?.organization ?? null;

  if (activeOrganization && auth.session.activeOrganizationId !== activeOrganization.id) {
    await prisma.session.update({
      where: { id: auth.session.id },
      data: { activeOrganizationId: activeOrganization.id },
    });
  }

  return {
    user: auth.user,
    sessionId: auth.session.id,
    memberships,
    activeOrganization,
    activeMembership:
      memberships.find((item) => item.organizationId === activeOrganization?.id) ?? null,
  };
}

export type CurrentAuth = NonNullable<Awaited<ReturnType<typeof getCurrentAuth>>>;
export type { PublicUser };
