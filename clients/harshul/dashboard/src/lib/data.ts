import "server-only";
import type {
  Employee,
  FollowUp,
  Message,
  Sale,
  Template,
  UpsellRule,
} from "./types";
import {
  appendRaw,
  deleteRaw,
  parseBooleans,
  readRaw,
  updateRaw,
} from "./sheets";
import { overdueDays } from "./utils";

// Typed accessors on top of the raw Sheets/demo layer.

export async function getSales(): Promise<Sale[]> {
  return (await readRaw("Sales")) as unknown as Sale[];
}

export async function getMessages(): Promise<Message[]> {
  return (await readRaw("Messages")) as unknown as Message[];
}

/** Follow-ups with derived `overdue` status applied for pending+past-due rows. */
export async function getFollowUps(): Promise<FollowUp[]> {
  const rows = (await readRaw("Follow_Ups")) as unknown as FollowUp[];
  return rows.map((f) => {
    if (f.status === "pending" && overdueDays(f.due_date) > 0) {
      return { ...f, status: "overdue" as const };
    }
    return f;
  });
}

export async function getTemplates(): Promise<Template[]> {
  const rows = await readRaw("Templates");
  return rows.map((r) => parseBooleans<Template>("Templates", r));
}

export async function getUpsellRules(): Promise<UpsellRule[]> {
  const rows = await readRaw("Upsell_Rules");
  return rows.map((r) => parseBooleans<UpsellRule>("Upsell_Rules", r));
}

export async function getEmployees(): Promise<Employee[]> {
  const rows = await readRaw("Employees");
  return rows.map((r) => parseBooleans<Employee>("Employees", r));
}

// ── ID generators ─────────────────────────────────────────────

async function nextId(
  existing: string[],
  prefix: string,
  pad = 3,
): Promise<string> {
  let max = 0;
  for (const id of existing) {
    const m = id.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(pad, "0")}`;
}

// ── Follow-ups ────────────────────────────────────────────────

export async function createFollowUp(input: Partial<FollowUp>): Promise<FollowUp> {
  const rows = await getFollowUps();
  const ticket_id = await nextId(rows.map((r) => r.ticket_id), "FU-");
  const now = new Date().toISOString();
  const record: FollowUp = {
    ticket_id,
    sale_id: input.sale_id || "",
    customer_name: input.customer_name || "",
    phone: input.phone || "",
    task: input.task || "",
    description: input.description || "",
    assigned_to: input.assigned_to || "",
    assigned_phone: input.assigned_phone || "",
    due_date: input.due_date || now.slice(0, 10),
    status: "pending",
    created_at: now,
    done_at: "",
    done_by: "",
    notes: input.notes || "",
  };
  await appendRaw("Follow_Ups", record);
  return record;
}

export async function updateFollowUp(
  ticket_id: string,
  patch: Partial<FollowUp>,
): Promise<FollowUp | null> {
  return (await updateRaw("Follow_Ups", ticket_id, patch)) as unknown as FollowUp | null;
}

export async function markFollowUpDone(
  ticket_id: string,
  done_by: string,
  notes?: string,
): Promise<FollowUp | null> {
  const patch: Partial<FollowUp> = {
    status: "done",
    done_at: new Date().toISOString(),
    done_by,
  };
  if (notes) patch.notes = notes;
  return updateFollowUp(ticket_id, patch);
}

export async function snoozeFollowUp(
  ticket_id: string,
  days = 1,
): Promise<FollowUp | null> {
  const rows = await getFollowUps();
  const current = rows.find((r) => r.ticket_id === ticket_id);
  if (!current) return null;
  const base = new Date(current.due_date);
  base.setDate(base.getDate() + days);
  return updateFollowUp(ticket_id, {
    due_date: base.toISOString().slice(0, 10),
    status: "pending",
  });
}

// ── Templates ─────────────────────────────────────────────────

export async function createTemplate(input: Partial<Template>): Promise<Template> {
  const rows = await getTemplates();
  const template_id = input.template_id
    ? input.template_id
    : await nextId(rows.map((r) => r.template_id), "T-");
  const now = new Date().toISOString();
  const record: Template = {
    template_id,
    language: input.language || "HI+EN",
    body: input.body || "",
    media_url: input.media_url || "",
    delay_days: String(input.delay_days ?? "0"),
    condition_field: input.condition_field || "",
    condition_value: input.condition_value || "",
    active: input.active ?? true,
    created_at: now,
    updated_at: now,
  };
  await appendRaw("Templates", record);
  return record;
}

export async function updateTemplate(
  template_id: string,
  patch: Partial<Template>,
): Promise<Template | null> {
  const merged = { ...patch, updated_at: new Date().toISOString() };
  const row = await updateRaw("Templates", template_id, merged);
  return row ? parseBooleans<Template>("Templates", row) : null;
}

export async function deleteTemplate(template_id: string): Promise<boolean> {
  return deleteRaw("Templates", template_id);
}

// ── Upsell rules ──────────────────────────────────────────────

export async function createUpsellRule(input: Partial<UpsellRule>): Promise<UpsellRule> {
  const rows = await getUpsellRules();
  const rule_id = await nextId(rows.map((r) => r.rule_id), "U-", 2);
  const record: UpsellRule = {
    rule_id,
    product_category: input.product_category || "",
    upsell_product: input.upsell_product || "",
    message_hi: input.message_hi || "",
    message_en: input.message_en || "",
    image_url: input.image_url || "",
    active: input.active ?? true,
  };
  await appendRaw("Upsell_Rules", record);
  return record;
}

export async function updateUpsellRule(
  rule_id: string,
  patch: Partial<UpsellRule>,
): Promise<UpsellRule | null> {
  const row = await updateRaw("Upsell_Rules", rule_id, patch);
  return row ? parseBooleans<UpsellRule>("Upsell_Rules", row) : null;
}

export async function deleteUpsellRule(rule_id: string): Promise<boolean> {
  return deleteRaw("Upsell_Rules", rule_id);
}

// ── Employees ─────────────────────────────────────────────────

export async function createEmployee(input: Partial<Employee>): Promise<Employee> {
  const rows = await getEmployees();
  const employee_id = await nextId(rows.map((r) => r.employee_id), "EMP-");
  const record: Employee = {
    employee_id,
    name: input.name || "",
    phone: input.phone || "",
    role: input.role || "Salesman",
    active: input.active ?? true,
  };
  await appendRaw("Employees", record);
  return record;
}

export async function updateEmployee(
  employee_id: string,
  patch: Partial<Employee>,
): Promise<Employee | null> {
  const row = await updateRaw("Employees", employee_id, patch);
  return row ? parseBooleans<Employee>("Employees", row) : null;
}

export async function deleteEmployee(employee_id: string): Promise<boolean> {
  return deleteRaw("Employees", employee_id);
}
