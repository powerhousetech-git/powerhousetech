/** Shared outreach helpers (Express portal). */

const FOLLOW_STATUSES = Array.from({ length: 10 }, (_, i) => `Follow${i + 1} Sent`);

const LEGACY_STATUS_MAP = {
  'Day1 Sent': 'Follow1 Sent',
  'Day4 Sent': 'Follow2 Sent',
  'Day9 Sent': 'Follow3 Sent',
};

const STATUSES = [
  'Queue',
  'Email Found',
  ...FOLLOW_STATUSES,
  'Replied',
  'Bounced',
  'Unsubscribed',
];

const ACTIVE_PIPELINE = ['Email Found', ...FOLLOW_STATUSES];

/** Statuses that mean "completed follow-up N" (1-indexed), including legacy Day labels. */
function statusesCompletedFollowUp(n) {
  const modern = `Follow${n} Sent`;
  if (n === 1) return [modern, 'Day1 Sent'];
  if (n === 2) return [modern, 'Day4 Sent'];
  if (n === 3) return [modern, 'Day9 Sent'];
  return [modern];
}

function normalizeStatus(status) {
  const s = String(status || '');
  return LEGACY_STATUS_MAP[s] || s;
}

const DEFAULT_CADENCE = [1, 4, 9, null, null, null, null, null, null, null];

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function trackForIndustrySlug(slug, name) {
  if (slug === 'ems') return 'Track B - EMS';
  if (slug === 'saas-startups') return 'Track A - Startups';
  return name || slug;
}

function parseCadenceDays(raw) {
  if (!Array.isArray(raw) || raw.length !== 10) {
    return { error: 'cadenceDays must be an array of exactly 10 elements.' };
  }

  const days = raw.map((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number.parseInt(v, 10);
    if (!Number.isInteger(n) || n < 1) return { bad: true };
    return n;
  });

  if (days.some((d) => d && typeof d === 'object' && d.bad)) {
    return { error: 'Each element must be null or a positive integer > 0.' };
  }

  let seenNull = false;
  for (const d of days) {
    if (d === null) seenNull = true;
    else if (seenNull) {
      return { error: 'Non-null values must all come before null values (no gaps).' };
    }
  }

  const active = days.filter((d) => d !== null);
  for (let i = 1; i < active.length; i++) {
    if (!(active[i - 1] < active[i])) {
      return { error: 'Days must be strictly ascending.' };
    }
  }
  if (active.length && active[0] < 1) {
    return { error: 'First non-null value must be >= 1.' };
  }

  return { days };
}

function normalizeCadence(value) {
  if (Array.isArray(value) && value.length === 10) return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const d1 = value.sequenceDay1 ?? 1;
    const d2 = value.sequenceDay2 ?? 4;
    const d3 = value.sequenceDay3 ?? 9;
    return [d1, d2, d3, null, null, null, null, null, null, null];
  }
  return DEFAULT_CADENCE.slice();
}

function renderTemplate(str, contact) {
  const full = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  const first =
    contact.firstName ||
    (full ? String(full).split(/\s+/)[0] : '') ||
    '';
  const last =
    contact.lastName ||
    (full ? String(full).split(/\s+/).slice(1).join(' ') : '') ||
    '';
  return String(str || '')
    .replace(/\{\{firstName\}\}/g, first)
    .replace(/\{\{lastName\}\}/g, last)
    .replace(/\{\{fullName\}\}/g, full || '')
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{title\}\}/g, contact.title || '')
    .replace(/\{\{country\}\}/g, contact.country || '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function parseCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line) => {
    const out = [];
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
  const rows = lines.slice(1).map((line, idx) => {
    const cols = split(line);
    const obj = { __row: idx + 2 };
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? '';
    });
    return obj;
  });
  return { headers, rows };
}

const DEFAULT_TEMPLATES = {
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

module.exports = {
  STATUSES,
  FOLLOW_STATUSES,
  ACTIVE_PIPELINE,
  LEGACY_STATUS_MAP,
  DEFAULT_CADENCE,
  DEFAULT_TEMPLATES,
  slugify,
  trackForIndustrySlug,
  parseCadenceDays,
  normalizeCadence,
  normalizeStatus,
  statusesCompletedFollowUp,
  renderTemplate,
  isValidEmail,
  parseCsv,
};
