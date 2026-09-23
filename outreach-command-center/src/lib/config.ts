/**
 * Frontend runtime configuration. Only NON-SECRET values live here — all
 * secrets (Google service-account key, n8n API key, app password) stay in the
 * serverless functions' env vars and are never exposed to the browser.
 */

export const IS_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/** Non-secret display config + workflow ids used to address the proxy. */
export interface AppConfig {
  /** For display only (the server holds the authoritative id). */
  spreadsheetId: string;
  n8nBaseUrl: string;
  indiaWorkflowId: string;
  usWorkflowId: string;
  tabs: { india: string; us: string; emailLog: string };
}

export function loadConfig(): AppConfig {
  return {
    spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID?.trim() || '',
    n8nBaseUrl:
      import.meta.env.VITE_N8N_BASE_URL?.trim() || 'https://shreyas-sinha.app.n8n.cloud',
    indiaWorkflowId: import.meta.env.VITE_N8N_INDIA_WORKFLOW_ID?.trim() || 'yrYIauoO1q46DORb',
    usWorkflowId: import.meta.env.VITE_N8N_US_WORKFLOW_ID?.trim() || '41O5a05zrxyWqpe2',
    tabs: {
      india: import.meta.env.VITE_SHEET_INDIA?.trim() || 'India Leads',
      us: import.meta.env.VITE_SHEET_US?.trim() || 'US Leads',
      emailLog: import.meta.env.VITE_SHEET_EMAIL_LOG?.trim() || 'Email Log',
    },
  };
}
