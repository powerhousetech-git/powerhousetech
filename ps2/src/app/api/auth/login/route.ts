import { NextRequest } from 'next/server';
import { signToken, verifyPassword } from '@/lib/auth';
import { getUserByUsername } from '@/lib/db';
import { COOKIE_NAME } from '@/lib/constants';
import { ok, err } from '@/lib/api';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function toSessionUser(user: {
  id: string;
  username: string;
  full_name: string;
  role: string;
  organization_id: string;
}) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role as 'sahasra_admin' | 'sahasra_employee' | 'pt_admin',
    organization_id: user.organization_id,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return err('Username and password are required');
    }

    const user = await getUserByUsername(username);
    if (!user || !user.is_active) {
      return err('Invalid credentials', 401);
    }

    const valid = await verifyPassword(password, user.password_hash!);
    if (!valid) {
      return err('Invalid credentials', 401);
    }

    const sessionUser = toSessionUser(user);
    const token = await signToken(sessionUser);

    const response = ok({ user: sessionUser });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch {
    return err('Login failed', 500);
  }
}
