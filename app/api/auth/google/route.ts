import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { generateToken } from "@/lib/crypto";

export async function GET() {
  if (!appConfig.googleOAuthEnabled) {
    return NextResponse.json(
      { error: "Google sign-in is not configured." },
      { status: 501 },
    );
  }

  const state = generateToken(16);
  const redirectUri = `${appConfig.appUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: appConfig.googleClientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  response.cookies.set("cp_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.nodeEnv === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
