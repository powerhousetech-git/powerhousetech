import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { corsHeaders, jsonResponse, optionsResponse } from '../_shared/cors.ts';
import {
  parseWebhookOverrides,
  parseWorkflowRunPath,
  readTriggerNodeName,
  readWebhookExtras,
  runN8nWorkflow,
  webhookOverrideFor,
} from './n8n-run.ts';
import {
  fetchApolloCreditUsage,
  LEGACY_OUTREACH_WORKFLOW_IDS,
  resolveApolloApiKey,
} from './apollo-credits.ts';

/**
 * Outreach Command Center backend proxy (Supabase Edge Function).
 *
 * The Command Center SPA (served on the main site at /command-center) calls this
 * with the signed-in admin's Firebase ID token as `Authorization: Bearer <token>`.
 * We verify the caller is an admin, then proxy to Google Sheets (read/write) or
 * the n8n REST API using server-only secrets. Secrets never reach the browser.
 *
 * Query params:
 *   target = "sheets" | "n8n" | "apollo"
 *   path   = URL-encoded sub-path (+ its own query string)
 *
 * Env (Supabase → Edge Function secrets). All are CC_-prefixed so they never
 * collide with other functions' project-wide secrets (e.g. ps2-lead-api's
 * N8N_API_KEY, outreach-api's ADMIN_EMAILS):
 *   CC_GOOGLE_SERVICE_ACCOUNT_JSON (base64), CC_SPREADSHEET_ID,
 *   CC_N8N_BASE_URL, CC_N8N_API_KEY,
 *   CC_ADMIN_EMAILS (optional, comma-separated; defaults to shreyas+yash@powerhousetech.in)
 *   CC_APOLLO_API_KEY (optional; falls back to APOLLO_API_KEY / APOLLO_KEY_1)
 */

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

// --- admin check -------------------------------------------------------------

function isAdminEmail(email: string): boolean {
  const list = (Deno.env.get('CC_ADMIN_EMAILS') || 'shreyas@powerhousetech.in,yash@powerhousetech.in')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email);
}

// --- Google access token (RS256 JWT signed with Web Crypto) ------------------

function base64UrlFromString(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlFromBytes(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGoogleToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlFromString(
    JSON.stringify({ iss: sa.client_email, scope: SHEETS_SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlFromBytes(sig)}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// --- handler -----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  // Authn: require a valid Firebase ID token belonging to an admin.
  const token = bearerToken(req);
  if (!token) return jsonResponse(401, { error: 'Missing bearer token' });
  let email: string;
  try {
    const user = await verifyFirebaseIdToken(token);
    email = user.email;
  } catch {
    return jsonResponse(401, { error: 'Invalid session' });
  }
  if (!isAdminEmail(email)) {
    return jsonResponse(403, { error: 'Not authorized' });
  }

  const url = new URL(req.url);
  const target = url.searchParams.get('target');
  const path = url.searchParams.get('path') || '';
  const body = req.method !== 'GET' && req.method !== 'OPTIONS' ? await req.text() : undefined;

  try {
    if (target === 'sheets') {
      const b64 = Deno.env.get('CC_GOOGLE_SERVICE_ACCOUNT_JSON');
      const spreadsheetId = Deno.env.get('CC_SPREADSHEET_ID');
      if (!b64 || !spreadsheetId) return jsonResponse(500, { error: 'Sheets env not configured' });
      const sa = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))) as ServiceAccount;
      const accessToken = await getGoogleToken(sa);
      const upstream = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
        method: req.method,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body,
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (target === 'apollo') {
      // GET ?target=apollo&path=credits — live lead-credit balance for Populate preview.
      const op = (path || 'credits').replace(/^\//, '').split('?')[0] || 'credits';
      if (op !== 'credits') return jsonResponse(400, { error: `Unknown apollo op "${op}"` });
      const apolloKey = resolveApolloApiKey(Deno.env);
      if (!apolloKey) {
        return jsonResponse(200, {
          available: false,
          leadCreditsLeft: null,
          leadCreditsLimit: null,
          leadCreditsConsumed: null,
          cycleStart: null,
          cycleEnd: null,
          message: 'Apollo API key not configured (set CC_APOLLO_API_KEY). Using ~1 credit/lead estimate.',
        });
      }
      const snapshot = await fetchApolloCreditUsage(apolloKey);
      return jsonResponse(200, snapshot);
    }

    if (target === 'n8n') {
      const base = Deno.env.get('CC_N8N_BASE_URL');
      const apiKey = Deno.env.get('CC_N8N_API_KEY');
      if (!base || !apiKey) return jsonResponse(500, { error: 'n8n env not configured' });

      // One-shot: deactivate legacy v1 India/US workflows after portal v2 cutover.
      if (req.method === 'POST' && path.replace(/^\//, '').split('?')[0] === 'retire-legacy') {
        const results: Array<{ id: string; ok: boolean; active?: boolean; error?: string }> = [];
        for (const id of LEGACY_OUTREACH_WORKFLOW_IDS) {
          try {
            const upstream = await fetch(
              `${base.replace(/\/$/, '')}/api/v1/workflows/${id}/deactivate`,
              {
                method: 'POST',
                headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' },
                body: '{}',
              },
            );
            const text = await upstream.text();
            let parsed: Record<string, unknown> = {};
            try {
              parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
            } catch {
              parsed = { raw: text };
            }
            results.push({
              id,
              ok: upstream.ok,
              active: typeof parsed.active === 'boolean' ? parsed.active : undefined,
              error: upstream.ok
                ? undefined
                : String(parsed.message || parsed.error || `HTTP ${upstream.status}`),
            });
          } catch (err) {
            results.push({
              id,
              ok: false,
              error: err instanceof Error ? err.message : 'deactivate failed',
            });
          }
        }
        return jsonResponse(200, { retired: results, ids: [...LEGACY_OUTREACH_WORKFLOW_IDS] });
      }

      // POST /workflows/{id}/run is not in n8n Cloud's public API (405). Intercept
      // Run Now and try /execute, then a discovered or override webhook.
      const runWorkflowId = req.method === 'POST' ? parseWorkflowRunPath(path) : null;
      if (runWorkflowId) {
        const overrides = parseWebhookOverrides(Deno.env.get('CC_N8N_WEBHOOKS') || '');
        const result = await runN8nWorkflow({
          baseUrl: base,
          apiKey,
          workflowId: runWorkflowId,
          triggerNodeName: readTriggerNodeName(body),
          webhookOverride: webhookOverrideFor(runWorkflowId, overrides),
          webhookExtras: readWebhookExtras(body),
        });
        return jsonResponse(result.status, result.body);
      }

      const upstream = await fetch(`${base.replace(/\/$/, '')}/api/v1/${path}`, {
        method: req.method,
        headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body,
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return jsonResponse(400, { error: 'Unknown target' });
  } catch (err) {
    return jsonResponse(502, { error: err instanceof Error ? err.message : 'Proxy error' });
  }
});
