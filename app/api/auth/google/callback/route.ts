import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { encryptSecret, parseEncryptionKey } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { upsertGoogleUser } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/service";

export async function GET(request: Request) {
  if (!appConfig.googleOAuthEnabled) {
    return NextResponse.redirect(new URL("/sign-in?oauth=disabled", appConfig.appUrl));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get("cp_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/sign-in?oauth=invalid", appConfig.appUrl));
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: appConfig.googleClientId!,
      client_secret: appConfig.googleClientSecret!,
      redirect_uri: `${appConfig.appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/sign-in?oauth=token", appConfig.appUrl));
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
  };

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) {
    return NextResponse.redirect(new URL("/sign-in?oauth=profile", appConfig.appUrl));
  }

  const profile = (await profileRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };

  if (!profile.email || !profile.email_verified) {
    return NextResponse.redirect(new URL("/sign-in?oauth=unverified", appConfig.appUrl));
  }

  const key = parseEncryptionKey(appConfig.encryptionKey);
  const user = await upsertGoogleUser(prisma, {
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email.split("@")[0],
    imageUrl: profile.picture,
    providerAccountId: profile.sub,
    accessTokenEnc: key ? encryptSecret(tokens.access_token, key) : null,
    refreshTokenEnc: key && tokens.refresh_token ? encryptSecret(tokens.refresh_token, key) : null,
  });

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organization: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
  });
  const { token } = await createSession(prisma, {
    userId: user.id,
    activeOrganizationId: membership?.organizationId,
  });

  const response = NextResponse.redirect(new URL("/dashboard", appConfig.appUrl));
  response.cookies.set(appConfig.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.nodeEnv === "production",
    path: "/",
    maxAge: appConfig.sessionTtlDays * 24 * 60 * 60,
  });
  response.cookies.delete("cp_oauth_state");
  return response;
}
