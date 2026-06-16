import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type CreditStatus = {
  email: string;
  runs_remaining: number;
  runs_used: number;
  can_run: boolean;
  last_tool_used: string | null;
};

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureCreditRow(email: string) {
  const { error } = await adminClient()
    .from('user_run_credits')
    .upsert(
      { email, runs_remaining: 1, runs_used: 0 },
      { onConflict: 'email', ignoreDuplicates: true },
    );

  if (error) {
    throw new Error('Credit storage unavailable: ' + error.message);
  }
}

export async function getCreditStatus(email: string): Promise<CreditStatus> {
  await ensureCreditRow(email);

  const { data, error } = await adminClient()
    .from('user_run_credits')
    .select('email, runs_remaining, runs_used, last_tool_used')
    .eq('email', email)
    .single();

  if (error || !data) {
    throw new Error('Credit storage unavailable: ' + (error?.message || 'not found'));
  }

  return {
    email: data.email,
    runs_remaining: data.runs_remaining,
    runs_used: data.runs_used,
    can_run: data.runs_remaining > 0,
    last_tool_used: data.last_tool_used ?? null,
  };
}

export async function consumeCredit(
  email: string,
  tool: string,
): Promise<{ ok: boolean; runs_remaining: number; runs_used: number }> {
  const { data, error } = await adminClient().rpc('consume_user_run_credit', {
    p_email: email,
    p_tool: tool,
  });

  if (error) {
    throw new Error('Could not consume run credit: ' + error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok),
    runs_remaining: Number(row?.runs_remaining ?? 0),
    runs_used: Number(row?.runs_used ?? 0),
  };
}
