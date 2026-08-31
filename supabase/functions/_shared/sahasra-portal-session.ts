const PREFIX = 'sp1.';

type PortalPayload = {
  u: string;
  r: string;
  o: string;
  e: number;
};

function secretKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Service role key not configured');
  return key;
}

async function hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(message: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(message);
  return expected === signature;
}

export async function signPortalToken(input: {
  username: string;
  role: string;
  org_id: string;
}): Promise<string> {
  const payload = btoa(
    JSON.stringify({
      u: input.username,
      r: input.role,
      o: input.org_id,
      e: Date.now() + 7 * 24 * 60 * 60 * 1000,
    } satisfies PortalPayload),
  );
  const sig = await hmacSign(payload);
  return PREFIX + payload + '.' + sig;
}

export async function verifyPortalToken(token: string): Promise<PortalPayload | null> {
  if (!token.startsWith(PREFIX)) return null;
  const rest = token.slice(PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 1) return null;
  const payloadB64 = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  if (!(await hmacVerify(payloadB64, sig))) return null;
  try {
    const payload = JSON.parse(atob(payloadB64)) as PortalPayload;
    if (!payload.u || !payload.r || !payload.o || !payload.e) return null;
    if (Date.now() > payload.e) return null;
    return payload;
  } catch {
    return null;
  }
}
