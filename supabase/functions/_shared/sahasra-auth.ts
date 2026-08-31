import { adminClient } from './portal-users.ts';

export type SahasraRole = 'costing_engineer' | 'reviewer' | 'admin';

export type SahasraMember = {
  email: string;
  username: string;
  org_id: string;
  full_name: string | null;
  role: SahasraRole;
};

export function memberFromPortalUser(row: {
  username: string;
  org_id: string;
  full_name: string | null;
  role: string;
}): SahasraMember {
  return {
    username: row.username,
    email: row.username + '@portal.sahasra',
    org_id: row.org_id,
    full_name: row.full_name,
    role: row.role as SahasraRole,
  };
}

export type OrgDefaults = {
  freight_in_pct: number;
  inventory_carrying_pct: number;
  rejection_pct: number;
  overhead_pct: number;
  freight_out_pct: number;
  margin_pct: number;
  labour_elec_multiplier: number;
  pcb_tooling_default: number;
};

export async function requireSahasraMember(email: string): Promise<SahasraMember> {
  const db = adminClient();
  const { data, error } = await db
    .from('sahasra_org_members')
    .select('email, org_id, full_name, role')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error('This Google account is not on the Sahasra portal yet.');
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  return data as SahasraMember;
}

export async function requireSahasraRole(
  email: string,
  allowed: SahasraRole[],
): Promise<SahasraMember> {
  const member = await requireSahasraMember(email);
  if (!allowed.includes(member.role)) {
    const err = new Error('You do not have permission for this action.');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return member;
}

export async function loadOrgDefaults(orgId: string): Promise<OrgDefaults> {
  const db = adminClient();
  const { data, error } = await db
    .from('sahasra_org_defaults')
    .select(
      'freight_in_pct, inventory_carrying_pct, rejection_pct, overhead_pct, freight_out_pct, margin_pct, labour_elec_multiplier, pcb_tooling_default',
    )
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;

  const row = data || {};
  return {
    freight_in_pct: Number(row.freight_in_pct ?? 5),
    inventory_carrying_pct: Number(row.inventory_carrying_pct ?? 1),
    rejection_pct: Number(row.rejection_pct ?? 1),
    overhead_pct: Number(row.overhead_pct ?? 3),
    freight_out_pct: Number(row.freight_out_pct ?? 5),
    margin_pct: Number(row.margin_pct ?? 10),
    labour_elec_multiplier: Number(row.labour_elec_multiplier ?? 0.005),
    pcb_tooling_default: Number(row.pcb_tooling_default ?? 600),
  };
}

export const COSTING_FIELDS = [
  'client_name',
  'assembly_name',
  'currency',
  'exchange_rate',
  'status',
  'current_step',
  'quantity',
  'bom_cost_elec',
  'bom_cost_mech',
  'pcb_cost',
  'freight_in_pct_override',
  'inventory_carrying_pct_override',
  'labour_elec_override',
  'labour_mech',
  'functional_ict_testing',
  'programming',
  'lubrication_grease',
  'aoi',
  'pca_labeling',
  'packaging_forwarding',
  'smt_pth',
  'pcb_vendor',
  'pcb_price',
  'pcb_size',
  'pcb_layer',
  'pcb_tooling_override',
  'smt_stencil',
  'mech_pkg_dev_tooling',
  'misc_tooling',
  'parts_lead_time',
  'production_lead_time',
  'engineering_lead_time',
  'rejection_pct_override',
  'overhead_pct_override',
  'freight_out_pct_override',
  'margin_pct_override',
] as const;
