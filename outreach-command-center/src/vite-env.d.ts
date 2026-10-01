/// <reference types="vite/client" />

// Only NON-SECRET values are exposed to the browser. Secrets (Google key, n8n
// API key, app password) live in the serverless functions' env, never here.
interface ImportMetaEnv {
  readonly VITE_SPREADSHEET_ID?: string;
  readonly VITE_N8N_BASE_URL?: string;
  readonly VITE_N8N_INDIA_WORKFLOW_ID?: string;
  readonly VITE_N8N_US_WORKFLOW_ID?: string;
  readonly VITE_SHEET_INDIA?: string;
  readonly VITE_SHEET_US?: string;
  readonly VITE_SHEET_EMAIL_LOG?: string;
  readonly VITE_USE_MOCK_DATA?: string;
  readonly VITE_COMMAND_CENTER_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
