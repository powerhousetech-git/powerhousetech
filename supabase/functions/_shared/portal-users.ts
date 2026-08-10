import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export type PortalUserRow = {
  email: string;
  firebase_uid: string | null;
  display_name: string | null;
  photo_url: string | null;
  company: string | null;
  phone: string | null;
  is_admin: boolean;
  first_seen_at: string;
  last_seen_at: string;
  login_count: number;
  last_path: string | null;
};

export async function upsertPortalSession(input: {
  email: string;
  firebase_uid: string;
  display_name?: string | null;
  photo_url?: string | null;
  path?: string | null;
  event_type?: string;
  meta?: Record<string, unknown>;
  company?: string | null;
  phone?: string | null;
}): Promise<{ user: PortalUserRow; is_admin: boolean }> {
  const db = adminClient();
  const email = input.email.trim().toLowerCase();

  const { data: existing } = await db
    .from('portal_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    email,
    firebase_uid: input.firebase_uid,
    last_seen_at: now,
    last_path: input.path ?? existing?.last_path ?? null,
  };

  if (input.display_name) patch.display_name = input.display_name;
  if (input.photo_url) patch.photo_url = input.photo_url;
  if (input.company !== undefined) patch.company = input.company;
  if (input.phone !== undefined) patch.phone = input.phone;

  if (!existing) {
    patch.first_seen_at = now;
    patch.login_count = 1;
    patch.is_admin = email === 'shreyas@powerhousetech.in';
  } else if (input.event_type === 'sign_in') {
    patch.login_count = Number(existing.login_count || 0) + 1;
  }

  const { data: user, error } = await db
    .from('portal_users')
    .upsert(patch, { onConflict: 'email' })
    .select('*')
    .single();

  if (error || !user) {
    throw new Error('Could not upsert portal user: ' + (error?.message || 'unknown'));
  }

  // Ensure seeded admin stays admin
  if (email === 'shreyas@powerhousetech.in' && !user.is_admin) {
    await db.from('portal_users').update({ is_admin: true }).eq('email', email);
    user.is_admin = true;
  }

  if (input.event_type) {
    const { error: evErr } = await db.from('portal_events').insert({
      email,
      event_type: input.event_type,
      path: input.path ?? null,
      meta: input.meta ?? {},
    });
    if (evErr) {
      console.error('portal_events insert failed', evErr.message);
    }
  }

  return { user: user as PortalUserRow, is_admin: Boolean(user.is_admin) };
}

export async function requireAdmin(email: string): Promise<PortalUserRow> {
  const db = adminClient();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await db
    .from('portal_users')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.is_admin) {
    const err = new Error('Admin access required');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return data as PortalUserRow;
}

export { adminClient };
