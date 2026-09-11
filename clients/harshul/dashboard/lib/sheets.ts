import "server-only";
import { google } from "googleapis";
import { sheetId } from "./constants";
import { cached, setMappingFetchedAt } from "./cache";
import { demoMapping, demoMessages, demoSheet1, demoEmployees } from "./demo";
import type { AIMapping } from "./types";

// ─────────────────────────────────────────────────────────────
// Read-only Google Sheets access.
//
// The AI mapping is the core pattern: every data fetch reads AI_Config first to
// learn how the (Hindi/English/mixed) Sheet1 columns map to standard keys.
//
// When GOOGLE_SERVICE_ACCOUNT_KEY is absent/invalid the app runs in DEMO MODE
// against in-memory fixtures that mirror the real sheet shape.
// ─────────────────────────────────────────────────────────────

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const MAPPING_TTL = 5 * 60 * 1000; // 5 minutes
const DATA_TTL = 60 * 1000; // 1 minute

function serviceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const creds = JSON.parse(raw);
    if (creds && creds.client_email && creds.private_key) return creds;
    return null;
  } catch {
    return null;
  }
}

export function isDemoMode(): boolean {
  return serviceAccount() === null;
}

function sheetsClient() {
  const creds = serviceAccount();
  if (!creds) throw new Error("Google service account not configured");
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
  return google.sheets({ version: "v4", auth });
}

async function readValues(range: string): Promise<string[][]> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range,
  });
  return (res.data.values as string[][] | undefined) ?? [];
}

/** Read AI_Config (row 1 = standard keys, row 2 = actual column headers). */
export async function getAIMapping(): Promise<AIMapping> {
  if (isDemoMode()) {
    setMappingFetchedAt(Date.now());
    return demoMapping();
  }
  return cached("ai_mapping", MAPPING_TTL, async () => {
    const values = await readValues("AI_Config!A1:Z2");
    const headers = values[0] || [];
    const cols = values[1] || [];
    const mapping: AIMapping = {};
    headers.forEach((h, i) => {
      const key = String(h).trim() as keyof AIMapping;
      if (cols[i]) mapping[key] = String(cols[i]).trim();
    });
    setMappingFetchedAt(Date.now());
    return mapping;
  });
}

/** Generic tab reader → array of rows keyed by the tab's actual headers. */
export async function getSheetData(tab: string): Promise<Record<string, string>[]> {
  if (isDemoMode()) {
    if (tab === "Sheet1") return demoSheet1();
    if (tab === "Messages") return demoMessages() as unknown as Record<string, string>[];
    if (tab === "Employees") {
      return demoEmployees().map((e) => ({ Name: e.name, Phone: e.phone, Role: e.role }));
    }
    return [];
  }
  return cached(`data:${tab}`, DATA_TTL, async () => {
    const values = await readValues(`${tab}!A1:Z1000`);
    const [headers, ...rows] = values;
    if (!headers) return [];
    return rows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[String(h).trim()] = row[i] ?? "";
      });
      return obj;
    });
  });
}
