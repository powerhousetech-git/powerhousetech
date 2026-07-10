import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type InvoiceRadarEntitlement = {
  email: string;
  enabled: boolean;
  webAppUrl: string | null;
  clientKey: string | null;
};

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getInvoiceRadarEntitlement(
  email: string,
): Promise<InvoiceRadarEntitlement> {
  const { data, error } = await adminClient()
    .from('user_service_entitlements')
    .select('email, invoice_radar_enabled, invoice_radar_web_app_url, invoice_radar_client_key')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw new Error('Entitlement storage unavailable: ' + error.message);
  }

  if (!data) {
    return { email, enabled: false, webAppUrl: null, clientKey: null };
  }

  return {
    email: data.email,
    enabled: Boolean(data.invoice_radar_enabled),
    webAppUrl: data.invoice_radar_web_app_url ?? null,
    clientKey: data.invoice_radar_client_key ?? null,
  };
}

export function isEntitlementReady(ent: InvoiceRadarEntitlement): boolean {
  return ent.enabled && Boolean(ent.webAppUrl) && Boolean(ent.clientKey);
}
