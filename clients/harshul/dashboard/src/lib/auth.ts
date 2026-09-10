import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

// Dead-simple password gate (just 3-5 users — deliberately not over-engineered).
// The login route validates the password and sets an httpOnly cookie holding a
// token derived from the password; server components / API routes compare
// against the same derived token.

export const AUTH_COOKIE = "hrs_auth";

function password(): string {
  return process.env.DASHBOARD_PASSWORD || "harshul123";
}

export function expectedToken(): string {
  return crypto.createHash("sha256").update(password()).digest("hex");
}

export function checkPassword(candidate: string): boolean {
  const a = Buffer.from(candidate || "");
  const b = Buffer.from(password());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isAuthed(): boolean {
  const token = cookies().get(AUTH_COOKIE)?.value;
  return token === expectedToken();
}

/** For API route handlers — returns a 401 Response when not authed, else null. */
export function requireApiAuth(): Response | null {
  if (isAuthed()) return null;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
