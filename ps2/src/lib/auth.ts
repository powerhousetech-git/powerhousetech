import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "./constants";
import type { ApiResponse, UserRole } from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "ps2-dev-secret";
const secret = new TextEncoder().encode(JWT_SECRET);

export interface SessionUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  organization_id: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    organization_id: user.organization_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.id || !payload.role) return null;
    return {
      id: payload.id as string,
      username: payload.username as string,
      full_name: payload.full_name as string,
      role: payload.role as UserRole,
      organization_id: payload.organization_id as string,
    };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie?.value) return cookie.value;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(
  request: NextRequest
): Promise<{ user: SessionUser } | ApiResponse> {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  return { user };
}

export async function requireRole(
  request: NextRequest,
  roles: UserRole[]
): Promise<{ user: SessionUser } | ApiResponse> {
  const auth = await requireAuth(request);
  if ("success" in auth && !("user" in auth)) return auth;
  const { user } = auth as { user: SessionUser };
  if (!roles.includes(user.role)) {
    return { success: false, error: "Forbidden" };
  }
  return { user };
}

export function isApiResponse(
  result: { user: SessionUser } | ApiResponse
): result is ApiResponse {
  return "success" in result && result.success === false;
}
