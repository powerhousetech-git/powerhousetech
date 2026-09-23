/**
 * Google Sheets access — through the server-side proxy (`/api/sheets`).
 * The browser never sees the service-account key or spreadsheet id; it only
 * sends the Sheets sub-path (after the spreadsheet id) URL-encoded in `path`.
 */

import type { Lead, SheetData } from '../types';
import { apiFetch } from './apiClient';
import { loadConfig, type AppConfig } from './config';
import {
  columnLetter,
  LEAD_COLUMNS_INDIA,
  LEAD_COLUMNS_US,
  parseLeads,
  parseLog,
} from './parse';

/** Build the /api/sheets URL for a Sheets sub-path (+ optional query string). */
function sheetsUrl(subPath: string): string {
  return `/api/sheets?path=${encodeURIComponent(subPath)}`;
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

interface BatchGetResponse {
  valueRanges?: Array<{ range?: string; values?: string[][] }>;
}

export async function fetchSheetData(config?: AppConfig): Promise<SheetData> {
  const cfg = config ?? loadConfig();
  const ranges = [cfg.tabs.india, cfg.tabs.us, cfg.tabs.emailLog];
  const query = ranges.map((r) => `ranges=${encodeURIComponent(quoteTab(r))}`).join('&');
  const subPath = `/values:batchGet?${query}&majorDimension=ROWS`;

  const data = await apiFetch<BatchGetResponse>(sheetsUrl(subPath));
  const vr = data.valueRanges ?? [];
  return {
    indiaLeads: parseLeads(vr[0]?.values ?? [], 'India'),
    usLeads: parseLeads(vr[1]?.values ?? [], 'US'),
    emailLog: parseLog(vr[2]?.values ?? []),
  };
}

function leadColumns(campaign: 'India' | 'US'): readonly string[] {
  return campaign === 'US' ? LEAD_COLUMNS_US : LEAD_COLUMNS_INDIA;
}

/** Appends a new lead row to the correct tab. */
export async function appendLead(lead: Lead, config?: AppConfig): Promise<void> {
  const cfg = config ?? loadConfig();
  const tab = lead.campaign === 'US' ? cfg.tabs.us : cfg.tabs.india;
  const cols = leadColumns(lead.campaign);
  const rowValues = cols.map((c) => (lead as unknown as Record<string, string>)[c] ?? '');

  const subPath =
    `/values/${quoteTab(tab)}!A:Z:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  await apiFetch(sheetsUrl(subPath), { method: 'POST', body: { values: [rowValues] } });
}

/** Updates a single cell (Status/Notes) for a lead by its 1-based sheet row. */
export async function updateLeadCell(
  campaign: 'India' | 'US',
  rowIndex: number,
  columnName: string,
  value: string,
  config?: AppConfig,
): Promise<void> {
  const cfg = config ?? loadConfig();
  const tab = campaign === 'US' ? cfg.tabs.us : cfg.tabs.india;
  const cols = leadColumns(campaign);
  const colIdx = cols.indexOf(columnName);
  if (colIdx < 0) throw new Error(`Unknown column "${columnName}".`);
  const a1 = `${columnLetter(colIdx)}${rowIndex}`;

  const subPath = `/values/${quoteTab(tab)}!${a1}?valueInputOption=USER_ENTERED`;
  await apiFetch(sheetsUrl(subPath), { method: 'PUT', body: { values: [[value]] } });
}
