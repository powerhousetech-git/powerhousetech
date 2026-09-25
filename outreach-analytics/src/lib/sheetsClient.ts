/**
 * Google Sheets API v4 client — service-account auth, read-only.
 *
 * The task calls for reading the sheet directly from the frontend using a
 * Google service account. `google-auth-library` is a Node package and does not
 * run cleanly in a browser bundle (it relies on Node's `crypto`/`http`), so
 * this module implements the exact same OAuth2 "JWT bearer" flow using the
 * browser-native WebCrypto API to sign the assertion with RS256.
 *
 * SECURITY NOTE: bundling a service-account private key into a client app makes
 * that key readable by anyone who loads the page. This is acceptable only for a
 * private/internal deployment (e.g. an access-gated internal dashboard) with a
 * dedicated read-only service account. For anything public, put this behind a
 * small backend proxy. See README.
 */

import type { SheetData } from '../types';
import { parseLeads, parseLog } from './parse';

const TOKEN_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

/** Resolved runtime configuration read from Vite env vars. */
export interface SheetsConfig {
  spreadsheetId: string;
  serviceAccount: ServiceAccount;
  tabs: {
    india: string;
    us: string;
    emailLog: string;
  };
}

export class SheetsConfigError extends Error {}
export class SheetsApiError extends Error {}

/** Base64 (standard) -> UTF-8 string. */
function decodeBase64ToString(b64: string): string {
  const clean = b64.trim().replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Base64url-encode a string (JWT segment). */
function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url-encode raw bytes (JWT signature). */
function base64UrlEncodeBytes(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Convert a PEM PKCS#8 private key into an ArrayBuffer of DER bytes. */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Reads and validates configuration from `import.meta.env`.
 * Throws {@link SheetsConfigError} with a helpful message when misconfigured.
 */
export function loadConfig(): SheetsConfig {
  const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID?.trim();
  const rawJson = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (!spreadsheetId) {
    throw new SheetsConfigError(
      'Missing VITE_SPREADSHEET_ID. Copy .env.example to .env and set it.',
    );
  }
  if (!rawJson) {
    throw new SheetsConfigError(
      'Missing VITE_GOOGLE_SERVICE_ACCOUNT_JSON. Copy .env.example to .env and set it.',
    );
  }

  let json: string;
  // Accept either a base64-encoded blob (recommended) or raw JSON.
  if (rawJson.startsWith('{')) {
    json = rawJson;
  } else {
    try {
      json = decodeBase64ToString(rawJson);
    } catch {
      throw new SheetsConfigError(
        'VITE_GOOGLE_SERVICE_ACCOUNT_JSON is not valid base64. Re-encode the key file.',
      );
    }
  }

  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(json) as Partial<ServiceAccount>;
  } catch {
    throw new SheetsConfigError(
      'The decoded service account is not valid JSON. Re-check VITE_GOOGLE_SERVICE_ACCOUNT_JSON.',
    );
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new SheetsConfigError(
      'Service account JSON is missing client_email or private_key.',
    );
  }

  return {
    spreadsheetId,
    serviceAccount: {
      client_email: parsed.client_email,
      // Env files often store the key with literal "\n"; normalize to real newlines.
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

// --- Access token (JWT bearer) with in-memory caching ------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function signJwt(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: TOKEN_SCOPE,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claims),
  )}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${base64UrlEncodeBytes(signature)}`;
}

async function getAccessToken(config: SheetsConfig): Promise<string> {
  // Reuse a still-valid token (refresh 60s before expiry).
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }

  const assertion = await signJwt(config.serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const res = await fetch(config.serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new SheetsApiError(
      `Failed to obtain access token (${res.status}). ${detail}`.trim(),
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// --- Sheet reads -------------------------------------------------------------

/** Wrap a sheet/tab name for A1 range notation (handles spaces). */
function toRange(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

interface BatchGetResponse {
  valueRanges?: Array<{ range?: string; values?: string[][] }>;
}

/**
 * Fetches all three tabs in a single batched call and returns fully parsed,
 * typed domain data.
 */
export async function fetchSheetData(config: SheetsConfig): Promise<SheetData> {
  const token = await getAccessToken(config);

  const ranges = [config.tabs.india, config.tabs.us, config.tabs.emailLog];
  const query = ranges
    .map((r) => `ranges=${encodeURIComponent(toRange(r))}`)
    .join('&');
  const url = `${SHEETS_BASE}/${config.spreadsheetId}/values:batchGet?${query}&majorDimension=ROWS`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Surface the most common misconfiguration explicitly.
    if (res.status === 403) {
      throw new SheetsApiError(
        'Access denied (403). Share the spreadsheet with the service account email (Viewer) and enable the Google Sheets API.',
      );
    }
    if (res.status === 404) {
      throw new SheetsApiError(
        'Spreadsheet not found (404). Check VITE_SPREADSHEET_ID and the tab names.',
      );
    }
    throw new SheetsApiError(`Sheets API error (${res.status}). ${detail}`.trim());
  }

  const data = (await res.json()) as BatchGetResponse;
  const valueRanges = data.valueRanges ?? [];

  // valueRanges come back in the same order as the requested ranges.
  const indiaValues = valueRanges[0]?.values ?? [];
  const usValues = valueRanges[1]?.values ?? [];
  const logValues = valueRanges[2]?.values ?? [];

  return {
    indiaLeads: parseLeads(indiaValues, 'India'),
    usLeads: parseLeads(usValues, 'US'),
    emailLog: parseLog(logValues),
  };
}
