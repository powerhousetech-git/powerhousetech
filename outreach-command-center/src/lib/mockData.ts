/**
 * Deterministic sample dataset for previewing the command center without any
 * Google/n8n credentials. Enabled by `VITE_USE_MOCK_DATA=true`. In this mode
 * writes and workflow actions are simulated locally (no network calls).
 */

import type {
  Campaign,
  Execution,
  Lead,
  LogEntry,
  OutreachSettings,
  SheetData,
  WorkflowStatus,
} from '../types';
import { DEFAULT_SETTINGS } from './parse';

const INDIA_INDUSTRIES = [
  'EMS', 'Textiles', 'Auto Components', 'Pharma', 'Chemicals',
  'Food Processing', 'Packaging', 'Machinery',
];
const US_INDUSTRIES = [
  'SaaS', 'Healthcare', 'Logistics', 'Manufacturing', 'Fintech',
  'Retail', 'Real Estate', 'Energy',
];
const STATUSES = [
  'Pending', 'In_Sequence', 'Completed', 'Rejected',
  'Replied', 'Interested', 'Not Interested',
];
const TITLES = ['Managing Director', 'CEO', 'VP Sales', 'Head of Ops', 'Founder'];
const US_STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'WA', 'MA', 'GA'];

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
  return d.toISOString().slice(0, 10);
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
    const industry = industries[Math.floor(rng() * industries.length)];
    const step =
      status === 'Pending' || status === 'Rejected' ? 0
      : status === 'Completed' ? 10
      : status === 'In_Sequence' ? 1 + Math.floor(rng() * 4)
      : status === 'Replied' || status === 'Interested' ? 2 + Math.floor(rng() * 3)
      : 0;
    const apolloId = hasApollo ? `apollo_${campaign}_${i + 1}` : '';
    leads.push({
      Company_Name: `${campaign === 'India' ? 'Bharat' : 'Acme'} ${industry.replace(/\s+/g, '')} ${i + 1}`,
      Contact_Name: `Contact ${i + 1}`,
      Title: TITLES[Math.floor(rng() * TITLES.length)],
      Email: hasEmail ? `contact${i + 1}@example.com` : '',
      Industry: industry,
      City: campaign === 'India' ? 'Pune' : 'Austin',
      State: campaign === 'US' ? US_STATES[Math.floor(rng() * US_STATES.length)] : '',
      Country: campaign === 'India' ? 'India' : 'United States',
      Website: '',
      LinkedIn_URL: hasApollo ? `https://linkedin.com/in/contact-${i + 1}` : '',
      Apollo_ID: apolloId,
      Apollo_Person_ID: apolloId,
      Added_Date: daysAgoIso(Math.floor(rng() * 30)),
      Status: status,
      Sequence_Step: String(step),
      Next_Send_Date: status === 'In_Sequence' ? daysAgoIso(0) : '',
      Notes:
        status === 'Interested' ? 'Asked for a call next week.'
        : status === 'Replied' ? 'Replied asking for pricing.'
        : '',
      Sent_Date: '',
      FU1_Date: '',
      FU2_Date: '',
      campaign,
      _rowIndex: i + 2,
    });
  }
  return leads;
}

function buildLog(seed: number): LogEntry[] {
  const rng = makeRng(seed);
  const types = ['Initial', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3'];
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
        Subject: type === 'Initial'
          ? 'Quick idea to automate your ops'
          : `Following up (${type})`,
        Status: rng() > 0.08 ? 'Sent' : 'Failed',
      });
    }
  }
  return log;
}

export function getMockSettings(): OutreachSettings {
  return {
    ...DEFAULT_SETTINGS,
    _rows: {
      India_Daily_Cap: 2,
      US_Daily_Cap: 3,
      FU_Interval_Days: 4,
      Max_Sequence_Steps: 5,
    },
  };
}

export function getMockData(): SheetData {
  return {
    indiaLeads: buildLeads('India', 120, INDIA_INDUSTRIES, 12345),
    usLeads: buildLeads('US', 95, US_INDUSTRIES, 67890),
    emailLog: buildLog(2468),
    settings: getMockSettings(),
  };
}

export function getMockWorkflows(): Record<Campaign, WorkflowStatus> {
  return {
    India: { id: 'c2JyDKolZaIhUlzs', name: 'PHT – India Outreach v2', active: true, updatedAt: daysAgoIso(1) },
    US: { id: 'fHFG8B2mhToK6bid', name: 'PHT – US Outreach v2', active: false, updatedAt: daysAgoIso(3) },
  };
}

export function getMockExecutions(workflowId: string): Execution[] {
  const rng = makeRng(workflowId.length * 7 + 3);
  const statuses: Execution['status'][] = ['success', 'success', 'error', 'success', 'success'];
  return statuses.map((status, i) => {
    const start = new Date();
    start.setHours(start.getHours() - (i + 1) * 6, Math.floor(rng() * 60));
    const stop = new Date(start.getTime() + (10_000 + Math.floor(rng() * 50_000)));
    return {
      id: `${workflowId}-exec-${1000 + i}`,
      workflowId,
      status,
      startedAt: start.toISOString(),
      stoppedAt: stop.toISOString(),
      mode: 'trigger',
    };
  });
}

export function getMockExecutionDetail(executionId: string): Execution {
  return {
    id: executionId,
    status: 'success',
    startedAt: daysAgoIso(0),
    stoppedAt: daysAgoIso(0),
    mode: 'trigger',
    data: {
      resultData: {
        runData: {
          'Schedule Trigger': [{ startTime: Date.now(), executionTime: 12 }],
          'Get Leads': [{ startTime: Date.now(), executionTime: 340, data: { main: [[{ json: { count: 24 } }]] } }],
          'Send Email': [{ startTime: Date.now(), executionTime: 1820, data: { main: [[{ json: { sent: 24, failed: 0 } }]] } }],
        },
      },
      note: 'This is sample execution data shown in mock mode.',
    },
  };
}
