/**
 * Google Sheets access — through the server-side proxy (`/api/sheets`).
 * The browser never sees the service-account key or spreadsheet id; it only
 * sends the Sheets sub-path (after the spreadsheet id) URL-encoded in `path`.
 */

import type { Lead, OutreachSettings, SheetData } from '../types';
import { apiFetch } from './apiClient';
import { COMMAND_CENTER_API, loadConfig, type AppConfig } from './config';
import {
  columnLetter,
  DEFAULT_SETTINGS,
  LEAD_COLUMNS,
  parseLeads,
  parseLog,
  parseSettings,
} from './parse';

/** Build the proxy URL for a Sheets sub-path (+ optional query string). */
function sheetsUrl(subPath: string): string {
  return `${COMMAND_CENTER_API}?target=sheets&path=${encodeURIComponent(subPath)}`;
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

interface BatchGetResponse {
  valueRanges?: Array<{ range?: string; values?: string[][] }>;
}

export async function fetchSheetData(config?: AppConfig): Promise<SheetData> {
  const cfg = config ?? loadConfig();
  const ranges = [cfg.tabs.india, cfg.tabs.us, cfg.tabs.emailLog, cfg.tabs.settings];
  const query = ranges.map((r) => `ranges=${encodeURIComponent(quoteTab(r))}`).join('&');
  const subPath = `/values:batchGet?${query}&majorDimension=ROWS`;

  try {
    const data = await apiFetch<BatchGetResponse>(sheetsUrl(subPath));
    const vr = data.valueRanges ?? [];
    return {
      indiaLeads: parseLeads(vr[0]?.values ?? [], 'India'),
      usLeads: parseLeads(vr[1]?.values ?? [], 'US'),
      emailLog: parseLog(vr[2]?.values ?? []),
      settings: parseSettings(vr[3]?.values ?? []),
    };
  } catch (err) {
    // Settings tab may be missing on older sheets — retry without it.
    const message = err instanceof Error ? err.message : String(err);
    if (!/Unable to parse range|Unable to parse|Settings/i.test(message)) throw err;
    const fallbackRanges = [cfg.tabs.india, cfg.tabs.us, cfg.tabs.emailLog];
    const query2 = fallbackRanges.map((r) => `ranges=${encodeURIComponent(quoteTab(r))}`).join('&');
    const data = await apiFetch<BatchGetResponse>(
      sheetsUrl(`/values:batchGet?${query2}&majorDimension=ROWS`),
    );
    const vr = data.valueRanges ?? [];
    return {
      indiaLeads: parseLeads(vr[0]?.values ?? [], 'India'),
      usLeads: parseLeads(vr[1]?.values ?? [], 'US'),
      emailLog: parseLog(vr[2]?.values ?? []),
      settings: { ...DEFAULT_SETTINGS, _rows: {} },
    };
  }
}

/** Appends a new lead row to the correct tab. */
export async function appendLead(lead: Lead, config?: AppConfig): Promise<void> {
  const cfg = config ?? loadConfig();
  const tab = lead.campaign === 'US' ? cfg.tabs.us : cfg.tabs.india;
  const rowValues = LEAD_COLUMNS.map((c) => (lead as unknown as Record<string, string>)[c] ?? '');

  const subPath =
    `/values/${quoteTab(tab)}!A:Z:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  await apiFetch(sheetsUrl(subPath), { method: 'POST', body: { values: [rowValues] } });
}

/** Updates a single cell for a lead by its 1-based sheet row. */
export async function updateLeadCell(
  campaign: 'India' | 'US',
  rowIndex: number,
  columnName: string,
  value: string,
  config?: AppConfig,
): Promise<void> {
  await updateLeadCells(campaign, rowIndex, { [columnName]: value }, config);
}

/** Updates multiple cells on the same lead row in one batch. */
export async function updateLeadCells(
  campaign: 'India' | 'US',
  rowIndex: number,
  fields: Record<string, string>,
  config?: AppConfig,
): Promise<void> {
  const cfg = config ?? loadConfig();
  const tab = campaign === 'US' ? cfg.tabs.us : cfg.tabs.india;
  const data = Object.entries(fields).map(([columnName, value]) => {
    const colIdx = LEAD_COLUMNS.indexOf(columnName as (typeof LEAD_COLUMNS)[number]);
    if (colIdx < 0) throw new Error(`Unknown column "${columnName}".`);
    const a1 = `${quoteTab(tab)}!${columnLetter(colIdx)}${rowIndex}`;
    return { range: a1, values: [[value]] };
  });

  await apiFetch(sheetsUrl('/values:batchUpdate'), {
    method: 'POST',
    body: { valueInputOption: 'USER_ENTERED', data },
  });
}

/**
 * Writes Settings key/value pairs. Uses Key|Value layout: updates Value in
 * column B for known rows, or appends missing keys.
 */
export async function writeSettings(
  next: Partial<Omit<OutreachSettings, '_rows'>>,
  current: OutreachSettings,
  config?: AppConfig,
): Promise<void> {
  const cfg = config ?? loadConfig();
  const tab = cfg.tabs.settings;
  const updates: Array<{ range: string; values: string[][] }> = [];
  const appends: string[][] = [];

  for (const [key, value] of Object.entries(next) as Array<
    [keyof Omit<OutreachSettings, '_rows'>, number]
  >) {
    if (value === undefined || Number.isNaN(value)) continue;
    const row = current._rows[key];
    if (row) {
      updates.push({
        range: `${quoteTab(tab)}!B${row}`,
        values: [[String(value)]],
      });
    } else {
      appends.push([key, String(value)]);
    }
  }

  if (updates.length) {
    await apiFetch(sheetsUrl('/values:batchUpdate'), {
      method: 'POST',
      body: { valueInputOption: 'USER_ENTERED', data: updates },
    });
  }
  if (appends.length) {
    // Ensure header exists when the tab is empty.
    if (!Object.keys(current._rows).length) {
      await apiFetch(
        sheetsUrl(
          `/values/${quoteTab(tab)}!A1:B1?valueInputOption=USER_ENTERED`,
        ),
        { method: 'PUT', body: { values: [['Key', 'Value']] } },
      );
    }
    await apiFetch(
      sheetsUrl(
        `/values/${quoteTab(tab)}!A:B:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      ),
      { method: 'POST', body: { values: appends } },
    );
  }
}
