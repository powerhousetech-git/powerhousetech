/**
 * Catalog of live product dashboards gated by entitlement.
 * Demos are general access for every signed-in user — not listed here.
 * Add a new entry (+ matching DB column) when a live service ships.
 */
export type LiveServiceId =
  | 'ai_sales_outreach'
  | 'card_capture'
  | 'invoice_radar';

export type LiveServiceDef = {
  id: LiveServiceId;
  label: string;
  short: string;
  column:
    | 'ai_sales_outreach_enabled'
    | 'card_capture_enabled'
    | 'invoice_radar_enabled';
};

export const LIVE_SERVICES: LiveServiceDef[] = [
  {
    id: 'ai_sales_outreach',
    label: 'AI Sales Outreach',
    short: 'Outreach',
    column: 'ai_sales_outreach_enabled',
  },
  {
    id: 'card_capture',
    label: 'Card Capture',
    short: 'Cards',
    column: 'card_capture_enabled',
  },
  {
    id: 'invoice_radar',
    label: 'Invoice Radar',
    short: 'Radar',
    column: 'invoice_radar_enabled',
  },
];

export const GENERAL_ACCESS = {
  id: 'demos',
  label: 'Demos (all products)',
  short: 'Demos',
  always: true as const,
  note: 'Every signed-in user can open public product demos.',
};

export function serviceById(id: string): LiveServiceDef | undefined {
  return LIVE_SERVICES.find((s) => s.id === id);
}

export function accessFromRow(row: Record<string, unknown> | null | undefined) {
  const access: Record<LiveServiceId, boolean> = {
    ai_sales_outreach: false,
    card_capture: false,
    invoice_radar: false,
  };
  if (!row) return access;
  for (const s of LIVE_SERVICES) {
    access[s.id] = Boolean(row[s.column]);
  }
  return access;
}
