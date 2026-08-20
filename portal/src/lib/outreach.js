/** Shared outreach status helpers (Express portal). */

const FOLLOW_STATUSES = Array.from({ length: 10 }, (_, i) => `Follow${i + 1} Sent`);

const STATUSES = [
  'Queue',
  'Email Found',
  ...FOLLOW_STATUSES,
  'Replied',
  'Bounced',
  'Unsubscribed',
];

const DEFAULT_CADENCE = [1, 4, 9, null, null, null, null, null, null, null];

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
    if (d === null) {
      seenNull = true;
    } else if (seenNull) {
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
  // Legacy 3-int shape migration fallback
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const d1 = value.sequenceDay1 ?? 1;
    const d2 = value.sequenceDay2 ?? 4;
    const d3 = value.sequenceDay3 ?? 9;
    return [d1, d2, d3, null, null, null, null, null, null, null];
  }
  return DEFAULT_CADENCE.slice();
}

module.exports = {
  STATUSES,
  FOLLOW_STATUSES,
  DEFAULT_CADENCE,
  parseCadenceDays,
  normalizeCadence,
};
