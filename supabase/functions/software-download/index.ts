import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

const PRODUCT = 'nce_converter_macos';
const DEFAULT_VERSION = '1.0.0';
const DOWNLOAD_PATH = '/dist/Powerhouse-macOS.dmg';
const DOWNLOAD_FILENAME = 'Powerhouse-macOS.dmg';

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getDownloadStatus(email: string) {
  const { data, error } = await adminClient()
    .from('software_downloads')
    .select('downloaded_at, product_version')
    .eq('email', email)
    .eq('product', PRODUCT)
    .order('downloaded_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error('Download history unavailable: ' + error.message);
  }

  const rows = data ?? [];
  const last = rows[0] ?? null;

  return {
    product: PRODUCT,
    download_count: rows.length,
    last_download_at: last?.downloaded_at ?? null,
    last_version: last?.product_version ?? null,
    downloaded_before: rows.length > 0,
  };
}

async function recordDownload(
  email: string,
  uid: string,
  userAgent: string | null,
  version: string,
) {
  const { error } = await adminClient()
    .from('software_downloads')
    .insert({
      email,
      firebase_uid: uid,
      product: PRODUCT,
      product_version: version,
      user_agent: userAgent,
    });

  if (error) {
    throw new Error('Could not record download: ' + error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const token = bearerToken(req);
  if (!token) {
    return jsonResponse(401, { error: 'Sign in required' });
  }

  let user;
  try {
    user = await verifyFirebaseIdToken(token);
  } catch (err) {
    return jsonResponse(401, {
      error: err instanceof Error ? err.message : 'Invalid sign-in session',
    });
  }

  try {
    if (req.method === 'GET') {
      const status = await getDownloadStatus(user.email);
      return jsonResponse(200, {
        ...status,
        platform: 'macos',
        filename: DOWNLOAD_FILENAME,
        version: DEFAULT_VERSION,
      });
    }

    if (req.method === 'POST') {
      const userAgent = req.headers.get('user-agent');
      await recordDownload(user.email, user.uid, userAgent, DEFAULT_VERSION);
      const status = await getDownloadStatus(user.email);

      return jsonResponse(200, {
        ok: true,
        url: DOWNLOAD_PATH,
        filename: DOWNLOAD_FILENAME,
        platform: 'macos',
        version: DEFAULT_VERSION,
        ...status,
      });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Download service error',
    });
  }
});
