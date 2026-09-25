/**
 * Deterministic sample dataset for previewing the dashboard without Google
 * credentials. Enable by setting `VITE_USE_MOCK_DATA=true` in your `.env`.
 * This is only imported when that flag is on; it is not used in normal operation.
 */

import type { Campaign, Lead, LogEntry, SheetData } from '../types';

const INDIA_INDUSTRIES = [
  'EMS',
  'Textiles',
  'Auto Components',
  'Pharma',
  'Chemicals',
  'Food Processing',
  'Packaging',
  'Machinery',
];
const US_INDUSTRIES = [
  'SaaS',
  'Healthcare',
  'Logistics',
  'Manufacturing',
  'Fintech',
  'Retail',
  'Real Estate',
  'Energy',
];
const STATUSES = [
  'New',
  'Sent',
  'FU1_Sent',
  'FU2_Sent',
  'Replied',
  'Interested',
  'Not Interested',
  'Unsubscribe',
];
const TITLES = ['Managing Director', 'CEO', 'VP Sales', 'Head of Ops', 'Founder'];
const US_STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'WA', 'MA', 'GA'];

// Small seeded PRNG so the sample is stable across reloads.
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function buildLeads(
  campaign: Campaign,
  count: number,
  industries: string[],
  seed: number,
): Lead[] {
  const rng = makeRng(seed);
  const leads: Lead[] = [];
  for (let i = 0; i < count; i += 1) {
    const status = STATUSES[Math.floor(rng() * STATUSES.length)];
    const hasApollo = rng() > 0.15;
    const hasEmail = hasApollo && rng() > 0.2;
    const company = `${campaign === 'India' ? 'Bharat' : 'Acme'} ${industries[
      Math.floor(rng() * industries.length)
    ].replace(/\s+/g, '')} ${i + 1}`;
    leads.push({
      Company_Name: company,
      Industry: industries[Math.floor(rng() * industries.length)],
      City: campaign === 'India' ? 'Pune' : 'Austin',
      Contact_Name: `Contact ${i + 1}`,
      Email: hasEmail ? `contact${i + 1}@example.com` : '',
      Title: TITLES[Math.floor(rng() * TITLES.length)],
      Status: status,
      Sent_Date: status !== 'New' ? daysAgoIso(Math.floor(rng() * 30)) : '',
      FU1_Date: ['FU1_Sent', 'FU2_Sent', 'Replied', 'Interested'].includes(status)
        ? daysAgoIso(Math.floor(rng() * 20))
        : '',
      FU2_Date: ['FU2_Sent', 'Replied', 'Interested'].includes(status)
        ? daysAgoIso(Math.floor(rng() * 10))
        : '',
      Apollo_Person_ID: hasApollo ? `apollo_${campaign}_${i + 1}` : '',
      Notes:
        status === 'Interested'
          ? 'Asked for a call next week.'
          : status === 'Replied'
            ? 'Replied asking for pricing.'
            : '',
      State: campaign === 'US' ? US_STATES[Math.floor(rng() * US_STATES.length)] : undefined,
      campaign,
    });
  }
  return leads;
}

function buildLog(seed: number): LogEntry[] {
  const rng = makeRng(seed);
  const types = ['Initial', 'Follow-up 1', 'Follow-up 2'];
  const log: LogEntry[] = [];
  for (let day = 0; day < 30; day += 1) {
    const sends = Math.floor(rng() * 8);
    for (let j = 0; j < sends; j += 1) {
      const campaign: Campaign = rng() > 0.5 ? 'India' : 'US';
      const type = types[Math.floor(rng() * types.length)];
      const d = new Date();
      d.setDate(d.getDate() - day);
      d.setHours(9 + Math.floor(rng() * 8), Math.floor(rng() * 60));
      log.push({
        Timestamp: d.toISOString(),
        Campaign: campaign,
        Company_Name: `${campaign === 'India' ? 'Bharat' : 'Acme'} Co ${j + 1}`,
        Contact_Name: `Contact ${j + 1}`,
        Email: `contact${j + 1}@example.com`,
        Email_Type: type,
        Subject:
          type === 'Initial'
            ? 'Quick idea to automate your ops'
            : `Following up (${type})`,
        Status: rng() > 0.08 ? 'Sent' : 'Failed',
      });
    }
  }
  return log;
}

export function getMockData(): SheetData {
  return {
    indiaLeads: buildLeads('India', 120, INDIA_INDUSTRIES, 12345),
    usLeads: buildLeads('US', 95, US_INDUSTRIES, 67890),
    emailLog: buildLog(2468),
  };
}
