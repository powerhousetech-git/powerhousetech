export type FirebaseUser = {
  email: string;
  uid: string;
};

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUser> {
  const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY')
    ?? 'AIzaSyD9fHOILnFLauZqd-C2AZwm-vrkpQk-sV4';

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  const body = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message || 'Invalid auth token';
    throw new Error(msg);
  }

  const user = (body as { users?: { email?: string; localId?: string }[] }).users?.[0];
  if (!user?.email || !user.localId) {
    throw new Error('Could not resolve signed-in user');
  }

  return {
    email: user.email.trim().toLowerCase(),
    uid: user.localId,
  };
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}
