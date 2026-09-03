import { v4 as uuidv4 } from "uuid";
import { hashPassword } from "./auth";
import {
  ADMIN_ID,
  EMPLOYEE_ID,
  LEAD_STATUSES,
  ORG_ID,
  PT_ADMIN_ID,
  PROJECT_STAGES,
} from "./constants";
import type {
  ActivityLog,
  ClientProject,
  DashboardStats,
  GoogleSheetConnection,
  Lead,
  LeadEmail,
  LeadFilters,
  MailSequenceStep,
  OutlookAccount,
  PaginatedResult,
  ProjectStage,
  StageTransition,
  SystemSetting,
  UploadBatch,
  User,
} from "./types";

interface DemoStore {
  users: User[];
  leads: Lead[];
  leadEmails: LeadEmail[];
  mailConfig: MailSequenceStep[];
  projects: ClientProject[];
  stageTransitions: StageTransition[];
  activityLog: ActivityLog[];
  settings: SystemSetting[];
  googleSheets: GoogleSheetConnection[];
  uploadBatches: UploadBatch[];
  outlookAccounts: OutlookAccount[];
}

const now = () => new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString();

let passwordHashes: Record<string, string> = {};
let store: DemoStore | null = null;

async function initHashes() {
  passwordHashes = {
    sahasra_admin: await hashPassword("sahasra_admin"),
    sahasra_employee: await hashPassword("sahasra_employee"),
    pt_admin: await hashPassword("pt_admin"),
  };
}

function createSeedStore(): DemoStore {
  const lead1Id = "f1a2b3c4-d5e6-7890-abcd-ef1234567891";
  const lead2Id = "f2a3b4c5-d6e7-8901-bcde-f12345678902";
  const lead3Id = "f3a4b5c6-d7e8-9012-cdef-12345678903";
  const lead4Id = "f4a5b6c7-d8e9-0123-def0-23456789014";
  const project1Id = "p1a2b3c4-d5e6-7890-abcd-ef1234567891";
  const project2Id = "p2a3b4c5-d6e7-8901-bcde-f12345678902";
  const draftEmailId = "e1a2b3c4-d5e6-7890-abcd-ef1234567891";

  const users: User[] = [
    {
      id: ADMIN_ID,
      organization_id: ORG_ID,
      username: "sahasra_admin",
      password_hash: passwordHashes.sahasra_admin,
      full_name: "Sahasra Admin",
      role: "sahasra_admin",
      outlook_account: "admin@sahasra.com",
      is_active: true,
      created_at: daysAgo(90),
      updated_at: daysAgo(1),
    },
    {
      id: EMPLOYEE_ID,
      organization_id: ORG_ID,
      username: "sahasra_employee",
      password_hash: passwordHashes.sahasra_employee,
      full_name: "Sahasra Employee",
      role: "sahasra_employee",
      outlook_account: "employee@sahasra.com",
      is_active: true,
      created_at: daysAgo(60),
      updated_at: daysAgo(2),
    },
    {
      id: PT_ADMIN_ID,
      organization_id: ORG_ID,
      username: "pt_admin",
      password_hash: passwordHashes.pt_admin,
      full_name: "PT Admin",
      role: "pt_admin",
      outlook_account: null,
      is_active: true,
      created_at: daysAgo(30),
      updated_at: daysAgo(3),
    },
  ];

  const leads: Lead[] = [
    {
      id: lead1Id,
      organization_id: ORG_ID,
      first_name: "Rajesh",
      last_name: "Kumar",
      full_name: "Rajesh Kumar",
      company: "TechCorp India",
      designation: "CEO",
      email: "rajesh@techcorp.in",
      phone: "+91 98765 43210",
      website: "https://techcorp.in",
      website_summary: "Leading IT services company in Bangalore",
      status: "new",
      source: "business_card",
      assigned_to: EMPLOYEE_ID,
      tags: ["enterprise", "priority"],
      custom_intro: null,
      notes: "Met at industry conference",
      meeting_scheduled_at: null,
      upload_batch_id: null,
      last_activity_at: daysAgo(1),
      created_at: daysAgo(5),
      updated_at: daysAgo(1),
    },
    {
      id: lead2Id,
      organization_id: ORG_ID,
      first_name: "Priya",
      last_name: "Sharma",
      full_name: "Priya Sharma",
      company: "GreenBuild Solutions",
      designation: "Procurement Head",
      email: "priya@greenbuild.com",
      phone: "+91 87654 32109",
      website: "https://greenbuild.com",
      website_summary: "Sustainable construction materials supplier",
      status: "mail_1_sent",
      source: "excel",
      assigned_to: ADMIN_ID,
      tags: ["construction"],
      custom_intro: null,
      notes: null,
      meeting_scheduled_at: null,
      upload_batch_id: null,
      last_activity_at: daysAgo(3),
      created_at: daysAgo(10),
      updated_at: daysAgo(3),
    },
    {
      id: lead3Id,
      organization_id: ORG_ID,
      first_name: "Amit",
      last_name: "Patel",
      full_name: "Amit Patel",
      company: "AutoParts Ltd",
      designation: "Director",
      email: "amit@autoparts.com",
      phone: "+91 76543 21098",
      website: "https://autoparts.com",
      website_summary: null,
      status: "responded",
      source: "google_sheet",
      assigned_to: EMPLOYEE_ID,
      tags: ["automotive"],
      custom_intro: "Interested in bulk steel supply",
      notes: "Positive response to first email",
      meeting_scheduled_at: null,
      upload_batch_id: null,
      last_activity_at: daysAgo(2),
      created_at: daysAgo(15),
      updated_at: daysAgo(2),
    },
    {
      id: lead4Id,
      organization_id: ORG_ID,
      first_name: "Sneha",
      last_name: "Reddy",
      full_name: "Sneha Reddy",
      company: "MediCare Hospitals",
      designation: "COO",
      email: "sneha@medicare.in",
      phone: "+91 65432 10987",
      website: "https://medicare.in",
      website_summary: "Multi-specialty hospital chain",
      status: "meeting_scheduled",
      source: "manual",
      assigned_to: ADMIN_ID,
      tags: ["healthcare", "hot"],
      custom_intro: null,
      notes: "Meeting scheduled for next week",
      meeting_scheduled_at: daysAgo(-5),
      upload_batch_id: null,
      last_activity_at: daysAgo(1),
      created_at: daysAgo(20),
      updated_at: daysAgo(1),
    },
  ];

  const leadEmails: LeadEmail[] = [
    {
      id: draftEmailId,
      lead_id: lead1Id,
      direction: "outbound",
      subject: "Partnership opportunity with Sahasra Group",
      body: "Dear Rajesh,\n\nI hope this email finds you well. I came across TechCorp India and was impressed by your work in the IT services sector.\n\nAt Sahasra Group, we specialize in high-quality steel and construction materials. I believe there could be a great synergy between our organizations.\n\nWould you be open to a brief call next week to explore potential collaboration?\n\nBest regards,\nSahasra Team",
      sentiment: null,
      sequence_step: 1,
      status: "pending_review",
      is_ai_draft: true,
      sent_at: null,
      received_at: null,
      created_at: daysAgo(0),
      created_by: ADMIN_ID,
    },
    {
      id: uuidv4(),
      lead_id: lead2Id,
      direction: "outbound",
      subject: "Introduction — Sahasra Group",
      body: "Dear Priya, thank you for your interest in our products...",
      sentiment: null,
      sequence_step: 1,
      status: "sent",
      is_ai_draft: false,
      sent_at: daysAgo(3),
      received_at: null,
      created_at: daysAgo(3),
      created_by: ADMIN_ID,
    },
    {
      id: uuidv4(),
      lead_id: lead3Id,
      direction: "inbound",
      subject: "Re: Steel supply inquiry",
      body: "Thank you for reaching out. We are interested in discussing bulk orders.",
      sentiment: "positive",
      sequence_step: null,
      status: "sent",
      is_ai_draft: false,
      sent_at: null,
      received_at: daysAgo(2),
      created_at: daysAgo(2),
      created_by: null,
    },
  ];

  const mailConfig: MailSequenceStep[] = Array.from({ length: 11 }, (_, i) => ({
    id: uuidv4(),
    organization_id: ORG_ID,
    step_number: i + 1,
    label: i === 0 ? "Initial Outreach" : `Follow Up ${i}`,
    day_offset: i === 0 ? 0 : i * 3,
    subject_template:
      i === 0
        ? "Partnership opportunity with {{company}}"
        : `Following up — {{company}}`,
    body_template:
      i === 0
        ? "Dear {{first_name}},\n\nI hope this email finds you well..."
        : `Dear {{first_name}},\n\nI wanted to follow up on my previous email...`,
    is_active: true,
    updated_at: daysAgo(30),
  }));

  const projects: ClientProject[] = [
    {
      id: project1Id,
      organization_id: ORG_ID,
      lead_id: null,
      client_name: "BuildMax Construction",
      project_name: "Commercial Tower Phase 2",
      order_value: 2500000,
      stage: "production",
      assigned_to: EMPLOYEE_ID,
      target_date: "2026-06-30",
      notes: "On track for Q2 delivery",
      quotation_ref: "QT-2026-0042",
      documents: [],
      stage_entered_at: daysAgo(14),
      created_at: daysAgo(60),
      updated_at: daysAgo(14),
    },
    {
      id: project2Id,
      organization_id: ORG_ID,
      lead_id: null,
      client_name: "SteelWorks Industries",
      project_name: "Warehouse Expansion",
      order_value: 850000,
      stage: "bid_submitted",
      assigned_to: ADMIN_ID,
      target_date: "2026-08-15",
      notes: "Awaiting client decision",
      quotation_ref: "QT-2026-0058",
      documents: [],
      stage_entered_at: daysAgo(7),
      created_at: daysAgo(30),
      updated_at: daysAgo(7),
    },
  ];

  const stageTransitions: StageTransition[] = [
    {
      id: uuidv4(),
      project_id: project1Id,
      from_stage: "order_won",
      to_stage: "production",
      notes: "Production started",
      documents: [],
      transitioned_by: ADMIN_ID,
      created_at: daysAgo(14),
    },
  ];

  const activityLog: ActivityLog[] = [
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      actor_id: ADMIN_ID,
      entity_type: "lead",
      entity_id: lead1Id,
      action: "created",
      summary: "New lead Rajesh Kumar added from business card",
      metadata: {},
      created_at: daysAgo(5),
    },
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      actor_id: EMPLOYEE_ID,
      entity_type: "lead_email",
      entity_id: draftEmailId,
      action: "draft_created",
      summary: "AI draft email created for Rajesh Kumar — pending review",
      metadata: {},
      created_at: daysAgo(0),
    },
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      actor_id: ADMIN_ID,
      entity_type: "lead",
      entity_id: lead3Id,
      action: "status_changed",
      summary: "Amit Patel responded positively to outreach email",
      metadata: { from: "mail_1_sent", to: "responded" },
      created_at: daysAgo(2),
    },
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      actor_id: ADMIN_ID,
      entity_type: "project",
      entity_id: project1Id,
      action: "stage_advanced",
      summary: "BuildMax project moved to Production stage",
      metadata: {},
      created_at: daysAgo(14),
    },
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      actor_id: EMPLOYEE_ID,
      entity_type: "lead",
      entity_id: lead4Id,
      action: "meeting_scheduled",
      summary: "Meeting scheduled with Sneha Reddy (MediCare Hospitals)",
      metadata: {},
      created_at: daysAgo(1),
    },
  ];

  const settings: SystemSetting[] = [
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      key: "ai_personalization",
      value: { enabled: true, model: "claude-sonnet" },
      updated_at: daysAgo(10),
    },
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      key: "email_sequence",
      value: { auto_send: false, review_required: true },
      updated_at: daysAgo(10),
    },
    {
      id: uuidv4(),
      organization_id: ORG_ID,
      key: "n8n_webhook",
      value: { url: "https://n8n.example.com/webhook/ps2", enabled: true },
      updated_at: daysAgo(5),
    },
  ];

  const outlookAccounts: OutlookAccount[] = [
    {
      id: uuidv4(),
      email: "admin@sahasra.com",
      display_name: "Sahasra Admin",
      is_connected: true,
      user_id: ADMIN_ID,
    },
    {
      id: uuidv4(),
      email: "employee@sahasra.com",
      display_name: "Sahasra Employee",
      is_connected: true,
      user_id: EMPLOYEE_ID,
    },
  ];

  return {
    users,
    leads,
    leadEmails,
    mailConfig,
    projects,
    stageTransitions,
    activityLog,
    settings,
    googleSheets: [],
    uploadBatches: [],
    outlookAccounts,
  };
}

export async function getDemoStore(): Promise<DemoStore> {
  if (!store) {
    await initHashes();
    store = createSeedStore();
  }
  return store;
}

export async function getUserByUsername(
  username: string
): Promise<User | null> {
  const s = await getDemoStore();
  return s.users.find((u) => u.username === username) ?? null;
}

export async function listUsers(): Promise<User[]> {
  const s = await getDemoStore();
  return s.users.map(({ password_hash: _, ...u }) => ({ ...u, password_hash: undefined })) as User[];
}

export async function createUser(
  data: Omit<User, "id" | "created_at" | "updated_at">
): Promise<User> {
  const s = await getDemoStore();
  const user: User = {
    ...data,
    id: uuidv4(),
    created_at: now(),
    updated_at: now(),
  };
  s.users.push(user);
  return user;
}

export async function updateUser(
  id: string,
  data: Partial<User>
): Promise<User | null> {
  const s = await getDemoStore();
  const idx = s.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  s.users[idx] = { ...s.users[idx], ...data, updated_at: now() };
  return s.users[idx];
}

export async function deleteUser(id: string): Promise<boolean> {
  const s = await getDemoStore();
  const idx = s.users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  s.users.splice(idx, 1);
  return true;
}

export async function listLeads(
  filters: LeadFilters = {}
): Promise<PaginatedResult<Lead>> {
  const s = await getDemoStore();
  let items = [...s.leads];

  if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    items = items.filter((l) => statuses.includes(l.status));
  }
  if (filters.source) {
    items = items.filter((l) => l.source === filters.source);
  }
  if (filters.assigned_to) {
    items = items.filter((l) => l.assigned_to === filters.assigned_to);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (l) =>
        l.full_name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
    );
  }
  if (filters.tags?.length) {
    items = items.filter((l) =>
      filters.tags!.some((t) => l.tags.includes(t))
    );
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const total = items.length;
  const start = (page - 1) * pageSize;
  items = items.slice(start, start + pageSize);

  return { items, total, page, pageSize };
}

export async function getLead(id: string): Promise<Lead | null> {
  const s = await getDemoStore();
  return s.leads.find((l) => l.id === id) ?? null;
}

export async function createLead(
  data: Omit<Lead, "id" | "created_at" | "updated_at">
): Promise<Lead> {
  const s = await getDemoStore();
  const lead: Lead = {
    ...data,
    id: uuidv4(),
    created_at: now(),
    updated_at: now(),
  };
  s.leads.push(lead);
  return lead;
}

export async function updateLead(
  id: string,
  data: Partial<Lead>
): Promise<Lead | null> {
  const s = await getDemoStore();
  const idx = s.leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  s.leads[idx] = { ...s.leads[idx], ...data, updated_at: now() };
  return s.leads[idx];
}

export async function deleteLead(id: string): Promise<boolean> {
  const s = await getDemoStore();
  const idx = s.leads.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  s.leads.splice(idx, 1);
  return true;
}

export async function bulkUpdateLeads(
  ids: string[],
  data: Partial<Lead>
): Promise<number> {
  const s = await getDemoStore();
  let count = 0;
  for (const id of ids) {
    const idx = s.leads.findIndex((l) => l.id === id);
    if (idx !== -1) {
      s.leads[idx] = { ...s.leads[idx], ...data, updated_at: now() };
      count++;
    }
  }
  return count;
}

export async function listLeadEmails(
  leadId?: string,
  status?: string
): Promise<LeadEmail[]> {
  const s = await getDemoStore();
  let items = [...s.leadEmails];
  if (leadId) items = items.filter((e) => e.lead_id === leadId);
  if (status) items = items.filter((e) => e.status === status);
  return items.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function createLeadEmail(
  data: Omit<LeadEmail, "id" | "created_at">
): Promise<LeadEmail> {
  const s = await getDemoStore();
  const email: LeadEmail = { ...data, id: uuidv4(), created_at: now() };
  s.leadEmails.push(email);
  return email;
}

export async function updateLeadEmail(
  id: string,
  data: Partial<LeadEmail>
): Promise<LeadEmail | null> {
  const s = await getDemoStore();
  const idx = s.leadEmails.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  s.leadEmails[idx] = { ...s.leadEmails[idx], ...data };
  return s.leadEmails[idx];
}

export async function listMailConfig(): Promise<MailSequenceStep[]> {
  const s = await getDemoStore();
  return [...s.mailConfig].sort((a, b) => a.step_number - b.step_number);
}

export async function updateMailConfigStep(
  stepNumber: number,
  data: Partial<MailSequenceStep>
): Promise<MailSequenceStep | null> {
  const s = await getDemoStore();
  const idx = s.mailConfig.findIndex((m) => m.step_number === stepNumber);
  if (idx === -1) return null;
  s.mailConfig[idx] = { ...s.mailConfig[idx], ...data, updated_at: now() };
  return s.mailConfig[idx];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const s = await getDemoStore();
  const leads = s.leads;
  const sentStatuses = [
    "mail_1_sent",
    "follow_up_1",
    "follow_up_2",
    "follow_up_3",
    "follow_up_4",
    "follow_up_5",
    "follow_up_6",
    "follow_up_7",
    "follow_up_8",
    "follow_up_9",
    "follow_up_10",
  ];

  const funnelGroups = [
    { key: "new", label: "New", statuses: ["new"] },
    { key: "sent", label: "Sent", statuses: sentStatuses },
    { key: "responded", label: "Responded", statuses: ["responded"] },
    {
      key: "meeting",
      label: "Meeting",
      statuses: ["meeting_scheduled"],
    },
    { key: "converted", label: "Converted", statuses: ["converted"] },
    { key: "discarded", label: "Discarded", statuses: ["discarded"] },
  ];

  return {
    total_leads: leads.length,
    new_leads: leads.filter((l) => l.status === "new").length,
    sent_leads: leads.filter((l) => sentStatuses.includes(l.status)).length,
    responded_leads: leads.filter((l) => l.status === "responded").length,
    meetings_scheduled: leads.filter((l) => l.status === "meeting_scheduled")
      .length,
    converted_leads: leads.filter((l) => l.status === "converted").length,
    discarded_leads: leads.filter((l) => l.status === "discarded").length,
    funnel: funnelGroups.map((g) => ({
      status: g.key,
      label: g.label,
      count: leads.filter((l) => g.statuses.includes(l.status)).length,
    })),
  };
}

export async function listActivity(
  limit = 20,
  filters?: { source?: string; assigned_to?: string; from?: string; to?: string }
): Promise<ActivityLog[]> {
  const s = await getDemoStore();
  let items = [...s.activityLog];
  if (filters?.from) {
    items = items.filter((a) => a.created_at >= filters.from!);
  }
  if (filters?.to) {
    items = items.filter((a) => a.created_at <= filters.to!);
  }
  return items
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}

export async function listProjects(): Promise<ClientProject[]> {
  const s = await getDemoStore();
  return [...s.projects];
}

export async function getProject(id: string): Promise<ClientProject | null> {
  const s = await getDemoStore();
  return s.projects.find((p) => p.id === id) ?? null;
}

export async function createProject(
  data: Omit<ClientProject, "id" | "created_at" | "updated_at">
): Promise<ClientProject> {
  const s = await getDemoStore();
  const project: ClientProject = {
    ...data,
    id: uuidv4(),
    created_at: now(),
    updated_at: now(),
  };
  s.projects.push(project);
  return project;
}

export async function updateProject(
  id: string,
  data: Partial<ClientProject>
): Promise<ClientProject | null> {
  const s = await getDemoStore();
  const idx = s.projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  s.projects[idx] = { ...s.projects[idx], ...data, updated_at: now() };
  return s.projects[idx];
}

export async function advanceProjectStage(
  id: string,
  toStage: ProjectStage,
  notes: string | null,
  userId: string | null
): Promise<ClientProject | null> {
  const s = await getDemoStore();
  const idx = s.projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const fromStage = s.projects[idx].stage;
  s.projects[idx] = {
    ...s.projects[idx],
    stage: toStage,
    stage_entered_at: now(),
    updated_at: now(),
  };
  s.stageTransitions.push({
    id: uuidv4(),
    project_id: id,
    from_stage: fromStage,
    to_stage: toStage,
    notes,
    documents: [],
    transitioned_by: userId,
    created_at: now(),
  });
  return s.projects[idx];
}

export async function listStageTransitions(
  projectId: string
): Promise<StageTransition[]> {
  const s = await getDemoStore();
  return s.stageTransitions
    .filter((t) => t.project_id === projectId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export async function listSettings(): Promise<SystemSetting[]> {
  const s = await getDemoStore();
  return [...s.settings];
}

export async function upsertSetting(
  key: string,
  value: unknown,
  organizationId: string = ORG_ID
): Promise<SystemSetting> {
  const s = await getDemoStore();
  const idx = s.settings.findIndex(
    (st) => st.key === key && st.organization_id === organizationId
  );
  if (idx !== -1) {
    s.settings[idx] = {
      ...s.settings[idx],
      value,
      updated_at: now(),
    };
    return s.settings[idx];
  }
  const setting: SystemSetting = {
    id: uuidv4(),
    organization_id: organizationId,
    key,
    value,
    updated_at: now(),
  };
  s.settings.push(setting);
  return setting;
}

export async function listGoogleSheets(): Promise<GoogleSheetConnection[]> {
  const s = await getDemoStore();
  return [...s.googleSheets];
}

export async function createGoogleSheet(
  data: Omit<GoogleSheetConnection, "id" | "created_at">
): Promise<GoogleSheetConnection> {
  const s = await getDemoStore();
  const sheet: GoogleSheetConnection = {
    ...data,
    id: uuidv4(),
    created_at: now(),
  };
  s.googleSheets.push(sheet);
  return sheet;
}

export async function updateGoogleSheet(
  id: string,
  data: Partial<GoogleSheetConnection>
): Promise<GoogleSheetConnection | null> {
  const s = await getDemoStore();
  const idx = s.googleSheets.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  s.googleSheets[idx] = { ...s.googleSheets[idx], ...data };
  return s.googleSheets[idx];
}

export async function logActivity(
  data: Omit<ActivityLog, "id" | "created_at">
): Promise<ActivityLog> {
  const s = await getDemoStore();
  const entry: ActivityLog = { ...data, id: uuidv4(), created_at: now() };
  s.activityLog.unshift(entry);
  return entry;
}

export async function listOutlookAccounts(): Promise<OutlookAccount[]> {
  const s = await getDemoStore();
  return [...s.outlookAccounts];
}
