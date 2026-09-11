import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Google OAuth restricted to the owner's email. When client id/secret are not
// set (e.g. local/demo), the gate is bypassed so the read-only dashboard stays
// viewable — see getSessionUser().

export function isAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export interface DashUser {
  name: string;
  email: string;
  image?: string | null;
}

export const authOptions: NextAuthOptions = {
  providers: isAuthConfigured()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }),
      ]
    : [],
  secret: process.env.NEXTAUTH_SECRET || "harshul-dev-secret-change-me",
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAIL;
      if (!allowed) return true;
      return (user.email || "").toLowerCase() === allowed.toLowerCase();
    },
  },
};

/** Current user for server components. Returns a demo user when auth is off. */
export async function getSessionUser(): Promise<DashUser | null> {
  if (!isAuthConfigured()) {
    return { name: "Demo", email: "demo@local", image: null };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const allowed = process.env.ALLOWED_EMAIL;
  if (allowed && session.user.email.toLowerCase() !== allowed.toLowerCase()) return null;
  return {
    name: session.user.name || session.user.email,
    email: session.user.email,
    image: session.user.image,
  };
}

/** Guard for API route handlers. Returns a 401 Response, or null when allowed. */
export async function requireApiUser(): Promise<Response | null> {
  const user = await getSessionUser();
  if (user) return null;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
