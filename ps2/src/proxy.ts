import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { COOKIE_NAME } from "@/lib/constants";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
const PT_ADMIN_ALLOWED = [
  "/settings/system",
  "/api/settings/system",
  "/api/auth/me",
  "/api/auth/logout",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  const token = getTokenFromRequest(request);
  const session = token ? await verifyToken(token) : null;

  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/auth/login") {
      return NextResponse.next();
    }

    // n8n workflows authenticate with x-api-key; route handlers validate it
    const apiKey = request.headers.get("x-api-key");
    if (
      apiKey &&
      process.env.N8N_API_KEY &&
      apiKey === process.env.N8N_API_KEY
    ) {
      return NextResponse.next();
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.role === "pt_admin") {
      const allowed = PT_ADMIN_ALLOWED.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "pt_admin") {
    if (!pathname.startsWith("/settings/system")) {
      return NextResponse.redirect(new URL("/settings/system", request.url));
    }
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();
  if (token && !request.cookies.get(COOKIE_NAME)) {
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
