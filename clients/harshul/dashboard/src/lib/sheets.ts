import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import type { SheetName } from "./types";
import {
  seedEmployees,
  seedFollowUps,
  seedMessages,
  seedSales,
  seedTemplates,
  seedUpsellRules,
} from "./fixtures";

// ─────────────────────────────────────────────────────────────
// Google Sheets data layer.
//
// When GOOGLE_SERVICE_ACCOUNT_KEY + SPREADSHEET_ID are configured we talk to
// the real Sheets REST API (auth via a self-signed service-account JWT — no
// external npm dependency). Otherwise we fall back to an in-memory DEMO STORE
// seeded from fixtures so the whole dashboard is usable without credentials.
//
// Column order per sheet MUST match what n8n reads/writes.
// ─────────────────────────────────────────────────────────────

export type RawRow = Record<string, string>;

export const SHEET_HEADERS: Record<SheetName, string[]> = {
  Sales: [
    "sale_id", "date", "customer_name", "phone", "product_category",
    "product_sku", "quantity", "amount", "salesperson", "msg_sequence_status",
  ],
  Messages: [
    "msg_id", "sale_id", "phone", "customer_name", "template_id",
    "message_body", "media_url", "send_at", "status", "sent_at",
    "delivered_at", "read_at", "error",
  ],
  Follow_Ups: [
    "ticket_id", "sale_id", "customer_name", "phone", "task", "description",
    "assigned_to", "assigned_phone", "due_date", "status", "created_at",
    "done_at", "done_by", "notes",
  ],
  Templates: [
    "template_id", "language", "body", "media_url", "delay_days",
    "condition_field", "condition_value", "active", "created_at", "updated_at",
  ],
  Upsell_Rules: [
    "rule_id", "product_category", "upsell_product", "message_hi",
    "message_en", "image_url", "active",
  ],
  Employees: ["employee_id", "name", "phone", "role", "active"],
};

const ID_FIELD: Record<SheetName, string> = {
  Sales: "sale_id",
  Messages: "msg_id",
  Follow_Ups: "ticket_id",
  Templates: "template_id",
  Upsell_Rules: "rule_id",
  Employees: "employee_id",
};

export const BOOLEAN_FIELDS: Record<SheetName, string[]> = {
  Sales: [],
  Messages: [],
  Follow_Ups: [],
  Templates: ["active"],
  Upsell_Rules: ["active"],
  Employees: ["active"],
};

// ── Configuration ─────────────────────────────────────────────

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  );
}

export function isDemoMode(): boolean {
  return !isSheetsConfigured();
}

function loadServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
  const json = raw.trim().startsWith("{")
    ? raw
    : fs.readFileSync(raw, "utf8");
  const parsed = JSON.parse(json);
  return {
    client_email: parsed.client_email,
    private_key: (parsed.private_key || "").replace(/\\n/g, "\n"),
  };
}

// ── Google auth (service-account JWT → access token) ──────────

let cachedToken: { token: string; exp: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const { client_email, private_key } = loadServiceAccount();
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const signature = base64url(
    crypto.sign("RSA-SHA256", Buffer.from(signingInput), private_key),
  );
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

function sheetsApi(path: string): string {
  const id = process.env.SPREADSHEET_ID;
  return `https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(sheetsApi(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

// ── In-memory demo store ──────────────────────────────────────

type DemoStore = Record<SheetName, RawRow[]>;
let demoStore: DemoStore | null = null;

function toRaw(sheet: SheetName, obj: object): RawRow {
  const rec = obj as Record<string, unknown>;
  const row: RawRow = {};
  for (const col of SHEET_HEADERS[sheet]) {
    const v = rec[col];
    if (typeof v === "boolean") row[col] = v ? "TRUE" : "FALSE";
    else row[col] = v === undefined || v === null ? "" : String(v);
  }
  return row;
}

function getDemoStore(): DemoStore {
  if (demoStore) return demoStore;
  demoStore = {
    Sales: seedSales().map((r) => toRaw("Sales", r)),
    Messages: seedMessages().map((r) => toRaw("Messages", r)),
    Follow_Ups: seedFollowUps().map((r) => toRaw("Follow_Ups", r)),
    Templates: seedTemplates().map((r) => toRaw("Templates", r)),
    Upsell_Rules: seedUpsellRules().map((r) => toRaw("Upsell_Rules", r)),
    Employees: seedEmployees().map((r) => toRaw("Employees", r)),
  };
  return demoStore;
}

// ── Raw CRUD (works against either backend) ───────────────────

export async function readRaw(sheet: SheetName): Promise<RawRow[]> {
  const headers = SHEET_HEADERS[sheet];
  if (isDemoMode()) {
    return getDemoStore()[sheet].map((r) => ({ ...r }));
  }
  const res = await apiFetch(`/values/${encodeURIComponent(sheet)}`);
  if (!res.ok) throw new Error(`Sheets read failed (${sheet}): ${res.status}`);
  const data = (await res.json()) as { values?: string[][] };
  const values = data.values || [];
  if (values.length === 0) return [];
  const sheetHeaders = values[0];
  return values.slice(1).map((rowArr) => {
    const row: RawRow = {};
    headers.forEach((h) => {
      const idx = sheetHeaders.indexOf(h);
      row[h] = idx >= 0 ? (rowArr[idx] ?? "") : "";
    });
    return row;
  });
}

export async function appendRaw(
  sheet: SheetName,
  obj: object,
): Promise<RawRow> {
  const row = toRaw(sheet, obj);
  if (isDemoMode()) {
    getDemoStore()[sheet].push(row);
    return row;
  }
  const values = [SHEET_HEADERS[sheet].map((h) => row[h])];
  const res = await apiFetch(
    `/values/${encodeURIComponent(sheet)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );
  if (!res.ok) throw new Error(`Sheets append failed (${sheet}): ${res.status}`);
  return row;
}

async function findRowIndex(sheet: SheetName, id: string): Promise<number> {
  const idField = ID_FIELD[sheet];
  const rows = await readRaw(sheet);
  return rows.findIndex((r) => r[idField] === id);
}

export async function updateRaw(
  sheet: SheetName,
  id: string,
  patch: object,
): Promise<RawRow | null> {
  const idx = await findRowIndex(sheet, id);
  if (idx < 0) return null;
  const patchRaw: RawRow = {};
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (!SHEET_HEADERS[sheet].includes(k)) continue;
    patchRaw[k] = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v ?? "");
  }

  if (isDemoMode()) {
    const store = getDemoStore()[sheet];
    store[idx] = { ...store[idx], ...patchRaw };
    return { ...store[idx] };
  }

  const rows = await readRaw(sheet);
  const merged = { ...rows[idx], ...patchRaw };
  const values = [SHEET_HEADERS[sheet].map((h) => merged[h] ?? "")];
  const rowNumber = idx + 2; // +1 header, +1 for 1-based
  const res = await apiFetch(
    `/values/${encodeURIComponent(sheet)}!A${rowNumber}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values }) },
  );
  if (!res.ok) throw new Error(`Sheets update failed (${sheet}): ${res.status}`);
  return merged;
}

export async function deleteRaw(sheet: SheetName, id: string): Promise<boolean> {
  const idx = await findRowIndex(sheet, id);
  if (idx < 0) return false;

  if (isDemoMode()) {
    getDemoStore()[sheet].splice(idx, 1);
    return true;
  }

  const sheetId = await getSheetId(sheet);
  const startIndex = idx + 1; // account for header row (0-based dimension index)
  const res = await apiFetch(`:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex, endIndex: startIndex + 1 },
          },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Sheets delete failed (${sheet}): ${res.status}`);
  return true;
}

let sheetIdCache: Record<string, number> | null = null;
async function getSheetId(sheet: SheetName): Promise<number> {
  if (!sheetIdCache) {
    const res = await apiFetch(`?fields=sheets(properties(sheetId,title))`);
    if (!res.ok) throw new Error(`Sheets metadata failed: ${res.status}`);
    const data = (await res.json()) as {
      sheets: { properties: { sheetId: number; title: string } }[];
    };
    sheetIdCache = {};
    for (const s of data.sheets) sheetIdCache[s.properties.title] = s.properties.sheetId;
  }
  const id = sheetIdCache[sheet];
  if (id === undefined) throw new Error(`Sheet tab not found: ${sheet}`);
  return id;
}

// ── Boolean (de)serialisation helper ──────────────────────────

export function parseBooleans<T>(sheet: SheetName, row: RawRow): T {
  const out: Record<string, unknown> = { ...row };
  for (const field of BOOLEAN_FIELDS[sheet]) {
    out[field] = String(row[field]).toUpperCase() === "TRUE";
  }
  return out as T;
}
