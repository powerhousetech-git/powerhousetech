/**
 * Converts raw Google Sheets `values` (array of rows) into typed domain
 * records by mapping the header row to object keys. This is resilient to column
 * reordering: columns are matched by their header name, not their position.
 */

import type { Campaign, Lead, LogEntry } from '../types';

/** Build a header-name -> column-index map from the first row. */
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
  const [header, ...rows] = values;
  const h = headerIndex(header);

  return rows
    .filter((row) => row.some((c) => (c ?? '').trim() !== ''))
    .map((row) => ({
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
    }));
}

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
