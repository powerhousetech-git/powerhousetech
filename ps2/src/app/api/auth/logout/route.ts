import { COOKIE_NAME } from '@/lib/constants';
import { ok } from '@/lib/api';

export async function POST() {
  const response = ok({ message: 'Logged out' });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
  return response;
}
