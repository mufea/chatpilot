import { NextResponse, type NextRequest } from "next/server";
import { appConfig } from "@/lib/config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/settings",
  "/admin",
  "/chatbots",
  "/knowledge",
  "/inbox",
  "/analytics",
  "/billing",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(appConfig.sessionCookieName)?.value);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if ((pathname === "/sign-in" || pathname === "/sign-up") && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/chatbots/:path*",
    "/knowledge/:path*",
    "/inbox/:path*",
    "/analytics/:path*",
    "/billing/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
