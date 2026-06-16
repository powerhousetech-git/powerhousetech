import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { consumeCredit, getCreditStatus } from '../_shared/user-credits.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

const ALLOWED_TOOLS = new Set([
  'financial_statements',
  'reminders',
  'bank_statements',
]);

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
      const status = await getCreditStatus(user.email);
      return jsonResponse(200, status);
    }

    if (req.method === 'POST') {
      let payload: Record<string, unknown> = {};
      try {
        payload = await req.json();
      } catch {
        return jsonResponse(400, { error: 'Invalid JSON body' });
      }

      const action = String(payload.action || '').trim();
      if (action !== 'consume') {
        return jsonResponse(400, { error: 'Unsupported action' });
      }

      const tool = String(payload.tool || '').trim();
      if (!ALLOWED_TOOLS.has(tool)) {
        return jsonResponse(400, { error: 'Invalid tool' });
      }

      const result = await consumeCredit(user.email, tool);
      if (!result.ok) {
        return jsonResponse(402, {
          error: 'no_credits',
          message: 'Your complimentary workspace run has been used.',
          runs_remaining: result.runs_remaining,
          runs_used: result.runs_used,
        });
      }

      return jsonResponse(200, {
        ok: true,
        runs_remaining: result.runs_remaining,
        runs_used: result.runs_used,
        can_run: result.runs_remaining > 0,
      });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Credit service error',
    });
  }
});
