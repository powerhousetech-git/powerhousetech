import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/outreach-api-lib.ts';
import { handleEarlyRoutes } from '../_shared/outreach-api-routes-a.ts';
import { handleMidRoutes } from '../_shared/outreach-api-routes-b.ts';
import { handleLateRoutes } from '../_shared/outreach-api-routes-c.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const url = new URL(req.url);
  const path =
    url.pathname.replace(/^\/functions\/v1\/outreach-api/, '').replace(/^\/outreach-api/, '') ||
    '/';

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/api/health')) {
      return jsonResponse(200, { ok: true, service: 'outreach-portal' });
    }

    const auth = await requireAuth(req);
    const early = await handleEarlyRoutes(req, url, path, auth);
    if (early) return early;
    const mid = await handleMidRoutes(req, url, path, auth);
    if (mid) return mid;
    const late = await handleLateRoutes(req, url, path, auth);
    if (late) return late;
    return jsonResponse(404, { error: 'Not found' });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    console.error(err);
    return jsonResponse(status === 401 || status === 403 ? status : 500, {
      error: err instanceof Error ? err.message : 'outreach-api error',
    });
  }
});
