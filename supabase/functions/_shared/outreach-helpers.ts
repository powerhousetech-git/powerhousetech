/**
 * Shared outreach helpers for the outreach-api edge function.
 * Mirrors /workspace/portal/src/lib/outreach.js (kept in sync intentionally).
 */

export const FOLLOW_STATUSES = Array.from({ length: 10 }, (_, i) => `Follow${i + 1} Sent`);

export const STATUSES = [
  'Queue',
  'Email Found',
  ...FOLLOW_STATUSES,
  'Replied',
  'Bounced',
  'Unsubscribed',
] as const;

export type Status = (typeof STATUSES)[number];

export const ACTIVE_PIPELINE: string[] = ['Email Found', ...FOLLOW_STATUSES];

export const DEFAULT_CADENCE: (number | null)[] = [
  1,
  4,
  9,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

export function slugify(name: unknown): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function trackForIndustrySlug(slug: unknown, name?: unknown): string {
  if (slug === 'ems') return 'Track B - EMS';
  if (slug === 'saas-startups') return 'Track A - Startups';
  return (name as string) || (slug as string) || '';
}

export type CadenceParseResult =
  | { ok: false; error: string }
  | { ok: true; error?: undefined; days: (number | null)[] };

export function parseCadenceDays(raw: unknown): CadenceParseResult {
  if (!Array.isArray(raw) || raw.length !== 10) {
    return { ok: false, error: 'cadenceDays must be an array of exactly 10 elements.' };
  }

  const days: (number | null)[] = [];
  for (const v of raw) {
    if (v === null || v === undefined || v === '') {
      days.push(null);
      continue;
    }
    const n = Number.parseInt(String(v), 10);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: 'Each element must be null or a positive integer > 0.' };
    }
    days.push(n);
  }

  let seenNull = false;
  for (const d of days) {
    if (d === null) seenNull = true;
    else if (seenNull) {
      return { ok: false, error: 'Non-null values must all come before null values (no gaps).' };
    }
  }

  const active = days.filter((d): d is number => d !== null);
  for (let i = 1; i < active.length; i++) {
    if (!(active[i - 1] < active[i])) {
      return { ok: false, error: 'Days must be strictly ascending.' };
    }
  }

  return { ok: true, days };
}

export function normalizeCadence(value: unknown): (number | null)[] {
  if (Array.isArray(value) && value.length === 10) {
    return value.map((v) => (v === null || v === undefined ? null : Number(v)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    const d1 = v.sequenceDay1 ?? 1;
    const d2 = v.sequenceDay2 ?? 4;
    const d3 = v.sequenceDay3 ?? 9;
    return [Number(d1), Number(d2), Number(d3), null, null, null, null, null, null, null];
  }
  return DEFAULT_CADENCE.slice();
}

export type RenderContact = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  title?: string | null;
  country?: string | null;
};

export function renderTemplate(str: unknown, contact: RenderContact): string {
  const full = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  const first = contact.firstName || (full ? String(full).split(/\s+/)[0] : '') || '';
  const last =
    contact.lastName || (full ? String(full).split(/\s+/).slice(1).join(' ') : '') || '';
  return String(str || '')
    .replace(/\{\{firstName\}\}/g, first)
    .replace(/\{\{lastName\}\}/g, last)
    .replace(/\{\{fullName\}\}/g, full || '')
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{title\}\}/g, contact.title || '')
    .replace(/\{\{country\}\}/g, contact.country || '');
}

export function isValidEmail(email: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export type CsvRow = Record<string, string> & { __row: number };

export function parseCsv(text: unknown): { headers: string[]; rows: CsvRow[] } {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const rows: CsvRow[] = lines.slice(1).map((line, idx) => {
    const cols = split(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? '';
    });
    return { ...obj, __row: idx + 2 } as CsvRow;
  });
  return { headers, rows };
}

export type DefaultTemplate = {
  followUpNum: number;
  name: string;
  subject: string;
  templateType: 'ai' | 'static';
  body: string;
};

export const DEFAULT_TEMPLATES: Record<string, DefaultTemplate[]> = {
  ems: [
    {
      followUpNum: 1,
      name: 'Initial — Card Capture Hook',
      subject: 'How do you follow up on trade show leads, {{firstName}}?',
      templateType: 'ai',
      body:
        'Write a concise cold email (under 100 words) from Shreyas at PowerhouseTech to {{firstName}} ({{title}} at {{company}}).\nHook: Companies that exhibit at trade shows collect 100–300 leads but follow up on fewer than 20% before the momentum dies.\nSolution: We built a system that goes from business card scan → personalised email → Calendly booking automatically, within 24 hours of the show. Already running for a PCB assembly company.\nCTA: Quick call to show how it works? Sign off as Shreyas, PowerhouseTech.',
    },
    {
      followUpNum: 2,
      name: 'Follow-up 1 — Live Demo Offer',
      subject: 'Re: your exhibition lead follow-up',
      templateType: 'ai',
      body:
        'Write a follow-up cold email (under 80 words) from Shreyas at PowerhouseTech to {{firstName}} at {{company}}.\nAngle: The leads you collected at your last show — how many became meetings? Our Card Capture system classifies replies, sends the right follow-up, and books meetings automatically. No manual work after the show.\nCTA: 15 minutes to show you the live demo?',
    },
    {
      followUpNum: 3,
      name: 'Breakup — Final Note',
      subject: 'Last note — PowerhouseTech',
      templateType: 'ai',
      body:
        "Write a brief final email (under 60 words) from Shreyas at PowerhouseTech to {{firstName}} at {{company}}.\nAcknowledge they're busy. One-line value prop: we turn trade show leads into booked meetings, automatically. Leave the door open. Sign off warmly.",
    },
  ],
  'saas-startups': [
    {
      followUpNum: 1,
      name: 'Initial — Contractor Offboarding Hook',
      subject: 'Quick question about contractor offboarding',
      templateType: 'ai',
      body:
        'Write a concise cold email (under 100 words) from Shreyas at PowerhouseTech to {{firstName}} ({{title}} at {{company}}).\nHook: When a contractor finishes an engagement — who ensures their Slack, GitHub, Notion, and HubSpot access is actually revoked? Most {{company}}-sized teams have 3–5 former contractors still active.\nCTA: Ask for 15 minutes. Sign off as Shreyas, PowerhouseTech. No fluff, no bold claims.',
    },
    {
      followUpNum: 2,
      name: 'Follow-up 1 — SOC 2 Angle',
      subject: 'Re: contractor access & SOC 2',
      templateType: 'ai',
      body:
        'Write a follow-up cold email (under 80 words) from Shreyas at PowerhouseTech to {{firstName}} at {{company}}.\nAngle: A contractor with lingering access is a SOC 2 audit finding — and a security risk. We automate the full lifecycle: Day 1 access provisioning through Day Last offboarding with a timestamped audit trail.\nCTA: 15 minutes this week? Keep it brief.',
    },
    {
      followUpNum: 3,
      name: 'Breakup — Final Note',
      subject: 'Last note — PowerhouseTech',
      templateType: 'ai',
      body:
        "Write a final breakup cold email (under 60 words) from Shreyas at PowerhouseTech to {{firstName}} at {{company}}.\nTone: light, not pushy. Acknowledge they're busy. Offer one last look at the tool. Say you'll stop reaching out after this.",
    },
  ],
};

/** Simple id generator for created rows (text primary keys). */
export function newId(prefix = 'id'): string {
  const uuid = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${uuid}`;
}
