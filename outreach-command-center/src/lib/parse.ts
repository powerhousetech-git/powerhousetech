/**
 * Converts raw Google Sheets `values` (array of rows) into typed domain
 * records by mapping the header row to object keys. Columns are matched by
 * header name, not position, so reordering columns in the sheet is safe.
 *
 * Each lead keeps its 1-based sheet row number (`_rowIndex`) so inline edits
 * can write back to the exact cell. Header is row 1, first data row is row 2.
 */

import type { Campaign, Lead, LogEntry, OutreachSettings } from '../types';

function headerIndex(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((name, i) => {
    map[(name ?? '').trim()] = i;
  });
  return map;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx === undefined) return '';
  const v = row[idx];
  return v === undefined || v === null ? '' : String(v).trim();
}

/** Parse a "leads" tab (India or US) into typed {@link Lead} rows. */
export function parseLeads(values: string[][], campaign: Campaign): Lead[] {
  if (!values || values.length < 2) return [];
  const header = values[0];
  const h = headerIndex(header);

  const leads: Lead[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i] ?? [];
    if (!row.some((c) => (c ?? '').trim() !== '')) continue; // skip blank rows
    const apolloId =
      cell(row, h['Apollo_ID']) || cell(row, h['Apollo_Person_ID']);
    leads.push({
      Company_Name: cell(row, h['Company_Name']),
      Contact_Name: cell(row, h['Contact_Name']),
      Title: cell(row, h['Title']),
      Email: cell(row, h['Email']),
      Industry: cell(row, h['Industry']),
      City: cell(row, h['City']),
      State: cell(row, h['State']),
      Country: cell(row, h['Country']) || (campaign === 'India' ? 'India' : 'United States'),
      Website: cell(row, h['Website']),
      LinkedIn_URL: cell(row, h['LinkedIn_URL']),
      Apollo_ID: apolloId,
      Apollo_Person_ID: apolloId,
      Added_Date: cell(row, h['Added_Date']),
      Status: cell(row, h['Status']),
      Sequence_Step: cell(row, h['Sequence_Step']),
      Next_Send_Date: cell(row, h['Next_Send_Date']),
      Notes: cell(row, h['Notes']),
      Sent_Date: cell(row, h['Sent_Date']),
      FU1_Date: cell(row, h['FU1_Date']),
      FU2_Date: cell(row, h['FU2_Date']),
      campaign,
      _rowIndex: i + 1, // values[i] is sheet row i+1 (values[0] = row 1 header)
    });
  }
  return leads;
}

/**
 * Canonical column order for appending a new lead row (matches Claude sheet v2).
 * Extra legacy columns are not written on append — the sheet headers define the
 * authoritative layout; we only fill the v2 set.
 */
export const LEAD_COLUMNS = [
  'Company_Name',
  'Contact_Name',
  'Title',
  'Email',
  'Industry',
  'City',
  'State',
  'Country',
  'Website',
  'LinkedIn_URL',
  'Apollo_ID',
  'Added_Date',
  'Status',
  'Sequence_Step',
  'Next_Send_Date',
] as const;

/** @deprecated Use LEAD_COLUMNS — kept for call sites that still distinguish. */
export const LEAD_COLUMNS_INDIA = LEAD_COLUMNS;
/** @deprecated Use LEAD_COLUMNS — US and India share the same headers in v2. */
export const LEAD_COLUMNS_US = LEAD_COLUMNS;

/** Parse the "Email Log" tab into typed {@link LogEntry} rows. */
export function parseLog(values: string[][]): LogEntry[] {
  if (!values || values.length < 2) return [];
  const [header, ...rows] = values;
  const h = headerIndex(header);

  return rows
    .filter((row) => row.some((c) => (c ?? '').trim() !== ''))
    .map((row) => ({
      Timestamp: cell(row, h['Timestamp']),
      Campaign: cell(row, h['Campaign']),
      Company_Name: cell(row, h['Company_Name']),
      Contact_Name: cell(row, h['Contact_Name']),
      Email: cell(row, h['Email']),
      Email_Type: cell(row, h['Email_Type']),
      Subject: cell(row, h['Subject']),
      Status: cell(row, h['Status']),
    }));
}

export const DEFAULT_SETTINGS: Omit<OutreachSettings, '_rows'> = {
  India_Daily_Cap: 30,
  US_Daily_Cap: 30,
  FU_Interval_Days: 3,
  Max_Sequence_Steps: 10,
};

const SETTINGS_KEYS = [
  'India_Daily_Cap',
  'US_Daily_Cap',
  'FU_Interval_Days',
  'Max_Sequence_Steps',
] as const;

type SettingsKey = (typeof SETTINGS_KEYS)[number];

function parseIntSafe(raw: string, fallback: number): number {
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Parse the Settings tab. Supports:
 *   A) Key | Value rows (preferred)
 *   B) Single header row with India_Daily_Cap / US_Daily_Cap / … as columns
 */
export function parseSettings(values: string[][]): OutreachSettings {
  const settings: OutreachSettings = {
    ...DEFAULT_SETTINGS,
    _rows: {},
  };
  if (!values || values.length === 0) return settings;

  const header = (values[0] ?? []).map((c) => String(c ?? '').trim());
  const h = headerIndex(header);

  // Format B: columns named like the keys.
  const hasWideHeader = SETTINGS_KEYS.some((k) => h[k] !== undefined);
  if (hasWideHeader && values.length >= 2) {
    const row = values[1] ?? [];
    for (const key of SETTINGS_KEYS) {
      if (h[key] === undefined) continue;
      settings[key] = parseIntSafe(cell(row, h[key]), DEFAULT_SETTINGS[key]);
      settings._rows[key] = 2;
    }
    return settings;
  }

  // Format A: Key | Value (or Setting | Value).
  const keyIdx = h['Key'] ?? h['Setting'] ?? h['Name'] ?? 0;
  const valIdx = h['Value'] ?? h['Val'] ?? 1;
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i] ?? [];
    const key = cell(row, keyIdx) as SettingsKey;
    if (!SETTINGS_KEYS.includes(key)) continue;
    settings[key] = parseIntSafe(cell(row, valIdx), DEFAULT_SETTINGS[key]);
    settings._rows[key] = i + 1;
  }
  return settings;
}

/**
 * Returns the A1 column letter for a 0-based column index, e.g. 0 -> "A".
 * Used to target a single cell for inline updates.
 */
export function columnLetter(index: number): string {
  let n = index;
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}
