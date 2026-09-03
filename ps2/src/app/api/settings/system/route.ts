import { NextRequest } from 'next/server';
import { isApiResponse, requireAuth } from '@/lib/auth';
import { listSettings, upsertSetting } from '@/lib/db';
import { ok, err } from '@/lib/api';

type SystemSettingsPayload = {
  ai_prompt_first_email: string;
  ai_prompt_reply: string;
  ai_prompt_sentiment: string;
  n8n_webhooks: {
    send_email: string;
    sync_sheets: string;
    process_replies: string;
  };
  health: {
    api_key_configured: boolean;
    anthropic_key_configured: boolean;
    supabase_service_key_configured: boolean;
  };
};

function readStringSetting(
  settings: Awaited<ReturnType<typeof listSettings>>,
  key: string,
  fallback = ''
): string {
  const row = settings.find((s) => s.key === key);
  if (!row || typeof row.value !== 'object' || row.value === null) return fallback;
  const value = (row.value as Record<string, unknown>).prompt;
  return typeof value === 'string' ? value : fallback;
}

function readWebhookSetting(
  settings: Awaited<ReturnType<typeof listSettings>>
): SystemSettingsPayload['n8n_webhooks'] {
  const row = settings.find((s) => s.key === 'n8n_webhooks');
  if (!row || typeof row.value !== 'object' || row.value === null) {
    return { send_email: '', sync_sheets: '', process_replies: '' };
  }
  const value = row.value as Record<string, unknown>;
  return {
    send_email: typeof value.send_email === 'string' ? value.send_email : '',
    sync_sheets: typeof value.sync_sheets === 'string' ? value.sync_sheets : '',
    process_replies:
      typeof value.process_replies === 'string' ? value.process_replies : '',
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isApiResponse(authResult)) {
    return err(authResult.error ?? 'Unauthorized', 401);
  }

  const session = authResult.user;
  if (session.role !== 'pt_admin') {
    return err('Forbidden: pt_admin role required', 403);
  }

  const settings = await listSettings();
  const payload: SystemSettingsPayload = {
    ai_prompt_first_email: readStringSetting(settings, 'ai_prompt_first_email'),
    ai_prompt_reply: readStringSetting(settings, 'ai_prompt_reply'),
    ai_prompt_sentiment: readStringSetting(settings, 'ai_prompt_sentiment'),
    n8n_webhooks: readWebhookSetting(settings),
    health: {
      api_key_configured: Boolean(process.env.N8N_API_KEY),
      anthropic_key_configured: Boolean(process.env.ANTHROPIC_API_KEY),
      supabase_service_key_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  };
  return ok(payload);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isApiResponse(authResult)) {
    return err(authResult.error ?? 'Unauthorized', 401);
  }

  const session = authResult.user;
  if (session.role !== 'pt_admin') {
    return err('Forbidden: pt_admin role required', 403);
  }

  try {
    const body = await req.json();
    if (body?.key) {
      const setting = await upsertSetting(
        body.key,
        body.value ?? {},
        session.organization_id
      );
      return ok(setting);
    }

    const updates = body as Partial<SystemSettingsPayload>;
    await Promise.all([
      upsertSetting(
        'ai_prompt_first_email',
        { prompt: updates.ai_prompt_first_email ?? '' },
        session.organization_id
      ),
      upsertSetting(
        'ai_prompt_reply',
        { prompt: updates.ai_prompt_reply ?? '' },
        session.organization_id
      ),
      upsertSetting(
        'ai_prompt_sentiment',
        { prompt: updates.ai_prompt_sentiment ?? '' },
        session.organization_id
      ),
      upsertSetting(
        'n8n_webhooks',
        updates.n8n_webhooks ?? {
          send_email: '',
          sync_sheets: '',
          process_replies: '',
        },
        session.organization_id
      ),
    ]);

    return ok({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update setting';
    return err(message, 500);
  }
}
