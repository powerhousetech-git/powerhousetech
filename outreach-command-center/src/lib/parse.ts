/**
 * Converts raw Google Sheets `values` (array of rows) into typed domain
 * records by mapping the header row to object keys. Columns are matched by
 * header name, not position, so reordering columns in the sheet is safe.
 *
 * Each lead keeps its 1-based sheet row number (`_rowIndex`) so inline edits
 * can write back to the exact cell. Header is row 1, first data row is row 2.
 */

import type { Campaign, Lead, LogEntry } from '../types';

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
    leads.push({
      Company_Name: cell(row, h['Company_Name']),
      Industry: cell(row, h['Industry']),
      City: cell(row, h['City']),
      Contact_Name: cell(row, h['Contact_Name']),
      Email: cell(row, h['Email']),
      Title: cell(row, h['Title']),
      Status: cell(row, h['Status']),
      Sent_Date: cell(row, h['Sent_Date']),
      FU1_Date: cell(row, h['FU1_Date']),
      FU2_Date: cell(row, h['FU2_Date']),
      Apollo_Person_ID: cell(row, h['Apollo_Person_ID']),
      Notes: cell(row, h['Notes']),
      State: campaign === 'US' ? cell(row, h['State']) : undefined,
      campaign,
      _rowIndex: i + 1, // values[i] is sheet row i+1 (values[0] = row 1 header)
    });
  }
  return leads;
}

/**
 * The canonical column order used when appending a new lead row so the values
 * line up with the sheet's columns. Mirrors the sheet spec.
 */
export const LEAD_COLUMNS_INDIA = [
  'Company_Name',
  'Industry',
  'City',
  'Contact_Name',
  'Email',
  'Title',
  'Status',
  'Sent_Date',
  'FU1_Date',
  'FU2_Date',
  'Apollo_Person_ID',
  'Notes',
] as const;

export const LEAD_COLUMNS_US = [...LEAD_COLUMNS_INDIA, 'State'] as const;

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

/**
 * Returns the A1 column letter for a header name in a leads tab, e.g. "Status"
 * -> "G". Used to target a single cell for inline updates.
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
