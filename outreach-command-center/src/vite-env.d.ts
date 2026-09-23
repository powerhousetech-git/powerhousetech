/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPREADSHEET_ID?: string;
  readonly VITE_GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  readonly VITE_N8N_BASE_URL?: string;
  readonly VITE_N8N_API_KEY?: string;
  readonly VITE_N8N_INDIA_WORKFLOW_ID?: string;
  readonly VITE_N8N_US_WORKFLOW_ID?: string;
  readonly VITE_SHEET_INDIA?: string;
  readonly VITE_SHEET_US?: string;
  readonly VITE_SHEET_EMAIL_LOG?: string;
  readonly VITE_USE_MOCK_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
