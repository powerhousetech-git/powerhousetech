/** Centralized runtime configuration read from Vite env vars. */

export class ConfigError extends Error {}

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export interface SheetsConfig {
  spreadsheetId: string;
  serviceAccount: ServiceAccount;
  tabs: { india: string; us: string; emailLog: string };
}

export interface N8nConfig {
  /** In dev we use the Vite proxy path; in prod the full base + /api/v1. */
  apiBase: string;
  apiKey: string;
  indiaWorkflowId: string;
  usWorkflowId: string;
}

export const IS_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

function decodeBase64ToString(b64: string): string {
  const clean = b64.trim().replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Loads + validates Google Sheets config. Throws {@link ConfigError}. */
export function loadSheetsConfig(): SheetsConfig {
  const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID?.trim();
  const rawJson = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (!spreadsheetId) {
    throw new ConfigError('Missing VITE_SPREADSHEET_ID.');
  }
  if (!rawJson || rawJson === 'base64_encoded_service_account_json') {
    throw new ConfigError('Missing VITE_GOOGLE_SERVICE_ACCOUNT_JSON.');
  }

  let json: string;
  if (rawJson.startsWith('{')) {
    json = rawJson;
  } else {
    try {
      json = decodeBase64ToString(rawJson);
    } catch {
      throw new ConfigError(
        'VITE_GOOGLE_SERVICE_ACCOUNT_JSON is not valid base64.',
      );
    }
  }

  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(json) as Partial<ServiceAccount>;
  } catch {
    throw new ConfigError('Decoded service account is not valid JSON.');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new ConfigError(
      'Service account JSON is missing client_email or private_key.',
    );
  }

  return {
    spreadsheetId,
    serviceAccount: {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
      token_uri: parsed.token_uri ?? 'https://oauth2.googleapis.com/token',
    },
    tabs: {
      india: import.meta.env.VITE_SHEET_INDIA?.trim() || 'India Leads',
      us: import.meta.env.VITE_SHEET_US?.trim() || 'US Leads',
      emailLog: import.meta.env.VITE_SHEET_EMAIL_LOG?.trim() || 'Email Log',
    },
  };
}

/** Loads + validates n8n config. Throws {@link ConfigError}. */
export function loadN8nConfig(): N8nConfig {
  const apiKey = import.meta.env.VITE_N8N_API_KEY?.trim();
  const indiaWorkflowId = import.meta.env.VITE_N8N_INDIA_WORKFLOW_ID?.trim();
  const usWorkflowId = import.meta.env.VITE_N8N_US_WORKFLOW_ID?.trim();
  const baseUrl =
    import.meta.env.VITE_N8N_BASE_URL?.trim() ||
    'https://shreyas-sinha.app.n8n.cloud';

  if (!apiKey || apiKey === 'your_n8n_api_key_here') {
    throw new ConfigError('Missing VITE_N8N_API_KEY.');
  }
  if (!indiaWorkflowId || !usWorkflowId) {
    throw new ConfigError('Missing VITE_N8N_INDIA/US_WORKFLOW_ID.');
  }

  // In dev, route through the Vite proxy to dodge CORS. In prod, call n8n
  // directly (this requires a same-origin proxy or permissive CORS — see README).
  const apiBase = import.meta.env.DEV
    ? '/n8n-api'
    : `${baseUrl.replace(/\/$/, '')}/api/v1`;

  return { apiBase, apiKey, indiaWorkflowId, usWorkflowId };
}
