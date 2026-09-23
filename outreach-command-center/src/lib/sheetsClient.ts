/**
 * Google Sheets API v4 client — service-account auth, READ + WRITE.
 *
 * Auth uses the OAuth2 "JWT bearer" flow signed in-browser with WebCrypto
 * (RS256). `google-auth-library` is a Node package and does not run cleanly in
 * a browser bundle, so this reproduces the same flow client-side.
 *
 * SECURITY: bundling a service-account private key into a client app exposes it
 * to anyone who loads the page. Use only for a private/internal, access-gated
 * deployment, or move these calls behind a backend proxy. See README.
 */

import type { Lead, SheetData } from '../types';
import { loadSheetsConfig, type SheetsConfig } from './config';
import {
  columnLetter,
  LEAD_COLUMNS_INDIA,
  LEAD_COLUMNS_US,
  parseLeads,
  parseLog,
} from './parse';

const READ_WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsApiError extends Error {}

// --- base64url helpers -------------------------------------------------------

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeBytes(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

// --- access token (JWT bearer) with expiry caching ---------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function signJwt(config: SheetsConfig): Promise<string> {
  const sa = config.serviceAccount;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: READ_WRITE_SCOPE,
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
  // Reuse a valid token; refresh 60s before the 1-hour expiry.
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }
  const assertion = await signJwt(config);
  const res = await fetch(config.serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new SheetsApiError(`Failed to get access token (${res.status}). ${detail}`.trim());
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// --- helpers -----------------------------------------------------------------

function toRange(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

function friendlyError(status: number, detail: string): SheetsApiError {
  if (status === 403) {
    return new SheetsApiError(
      'Access denied (403). Share the spreadsheet with the service account (Editor for writes) and enable the Sheets API.',
    );
  }
  if (status === 404) {
    return new SheetsApiError('Spreadsheet or tab not found (404). Check the ID and tab names.');
  }
  return new SheetsApiError(`Sheets API error (${status}). ${detail}`.trim());
}

// --- reads -------------------------------------------------------------------

interface BatchGetResponse {
  valueRanges?: Array<{ range?: string; values?: string[][] }>;
}

export async function fetchSheetData(config?: SheetsConfig): Promise<SheetData> {
  const cfg = config ?? loadSheetsConfig();
  const token = await getAccessToken(cfg);
  const ranges = [cfg.tabs.india, cfg.tabs.us, cfg.tabs.emailLog];
  const query = ranges.map((r) => `ranges=${encodeURIComponent(toRange(r))}`).join('&');
  const url = `${SHEETS_BASE}/${cfg.spreadsheetId}/values:batchGet?${query}&majorDimension=ROWS`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw friendlyError(res.status, await res.text().catch(() => ''));
  }
  const data = (await res.json()) as BatchGetResponse;
  const vr = data.valueRanges ?? [];
  return {
    indiaLeads: parseLeads(vr[0]?.values ?? [], 'India'),
    usLeads: parseLeads(vr[1]?.values ?? [], 'US'),
    emailLog: parseLog(vr[2]?.values ?? []),
  };
}

// --- writes ------------------------------------------------------------------

/** Column order used when appending, per campaign. */
function leadColumns(campaign: 'India' | 'US'): readonly string[] {
  return campaign === 'US' ? LEAD_COLUMNS_US : LEAD_COLUMNS_INDIA;
}

/** Appends a new lead row to the correct tab. Returns nothing on success. */
export async function appendLead(
  lead: Lead,
  config?: SheetsConfig,
): Promise<void> {
  const cfg = config ?? loadSheetsConfig();
  const token = await getAccessToken(cfg);
  const tab = lead.campaign === 'US' ? cfg.tabs.us : cfg.tabs.india;
  const cols = leadColumns(lead.campaign);
  const rowValues = cols.map((c) => (lead as unknown as Record<string, string>)[c] ?? '');

  const url =
    `${SHEETS_BASE}/${cfg.spreadsheetId}/values/${encodeURIComponent(
      `${toRange(tab)}!A:Z`,
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowValues] }),
  });
  if (!res.ok) {
    throw friendlyError(res.status, await res.text().catch(() => ''));
  }
}

/**
 * Updates a single cell (e.g. Status or Notes) for a lead. `columnName` is a
 * header name from the leads tab; `rowIndex` is the lead's 1-based sheet row.
 */
export async function updateLeadCell(
  campaign: 'India' | 'US',
  rowIndex: number,
  columnName: string,
  value: string,
  config?: SheetsConfig,
): Promise<void> {
  const cfg = config ?? loadSheetsConfig();
  const token = await getAccessToken(cfg);
  const tab = campaign === 'US' ? cfg.tabs.us : cfg.tabs.india;
  const cols = leadColumns(campaign);
  const colIdx = cols.indexOf(columnName);
  if (colIdx < 0) throw new SheetsApiError(`Unknown column "${columnName}".`);
  const a1 = `${columnLetter(colIdx)}${rowIndex}`;

  const url =
    `${SHEETS_BASE}/${cfg.spreadsheetId}/values/${encodeURIComponent(
      `${toRange(tab)}!${a1}`,
    )}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!res.ok) {
    throw friendlyError(res.status, await res.text().catch(() => ''));
  }
}
