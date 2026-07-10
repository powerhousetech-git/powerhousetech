import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import {
  getInvoiceRadarEntitlement,
  isEntitlementReady,
} from '../_shared/invoice-radar-entitlements.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

const UPSELL = {
  href: '/invoice-radar',
  contact: '/contact.html#book',
  message: 'Invoice Radar is not enabled for this account. Talk to Powerhouse to get started.',
};

function forbiddenResponse() {
  return jsonResponse(403, {
    error: 'forbidden',
    code: 'invoice_radar_not_entitled',
    message: UPSELL.message,
    upsell: UPSELL,
  });
}

async function forwardSnapshot(ent: Awaited<ReturnType<typeof getInvoiceRadarEntitlement>>) {
  const url = new URL(ent.webAppUrl!);
  url.searchParams.set('action', 'snapshot');
  url.searchParams.set('key', ent.clientKey!);

  const resp = await fetch(url.toString(), { method: 'GET' });
  const body = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    return jsonResponse(resp.status, {
      error: 'upstream_error',
      message: 'Could not load Invoice Radar data.',
      detail: body,
    });
  }

  return jsonResponse(200, body);
}

async function forwardWrite(
  ent: Awaited<ReturnType<typeof getInvoiceRadarEntitlement>>,
  payload: Record<string, unknown>,
) {
  const resp = await fetch(ent.webAppUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      key: ent.clientKey,
    }),
  });

  const body = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    return jsonResponse(resp.status, {
      error: 'upstream_error',
      message: 'Invoice Radar action failed.',
      detail: body,
    });
  }

  return jsonResponse(200, body);
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

  let ent;
  try {
    ent = await getInvoiceRadarEntitlement(user.email);
  } catch (err) {
    return jsonResponse(503, {
      error: 'entitlements_unavailable',
      message: err instanceof Error ? err.message : 'Service unavailable',
    });
  }

  if (!ent.enabled) {
    return forbiddenResponse();
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const op = url.searchParams.get('op');

    if (op === 'snapshot') {
      if (!isEntitlementReady(ent)) {
        return jsonResponse(503, {
          error: 'not_configured',
          message: 'Invoice Radar is enabled but not fully configured yet.',
        });
      }
      return forwardSnapshot(ent);
    }

    return jsonResponse(200, {
      enabled: true,
      services: { invoiceRadar: { enabled: true } },
    });
  }

  if (req.method === 'POST') {
    if (!isEntitlementReady(ent)) {
      return jsonResponse(503, {
        error: 'not_configured',
        message: 'Invoice Radar is enabled but not fully configured yet.',
      });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body' });
    }

    const action = String(payload.action || '').trim();
    if (!action) {
      return jsonResponse(400, { error: 'action is required' });
    }

    return forwardWrite(ent, payload);
  }

  return jsonResponse(405, { error: 'Method not allowed' });
});
