import * as demo from "./demo-store";
import { isDemoMode } from "./supabase";
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
  User,
} from "./types";

export async function getUserByUsername(username: string): Promise<User | null> {
  if (isDemoMode()) return demo.getUserByUsername(username);
  throw new Error("Supabase getUserByUsername not implemented");
}

export async function listUsers(): Promise<User[]> {
  if (isDemoMode()) return demo.listUsers();
  throw new Error("Supabase listUsers not implemented");
}

export async function createUser(
  data: Omit<User, "id" | "created_at" | "updated_at">
): Promise<User> {
  if (isDemoMode()) return demo.createUser(data);
  throw new Error("Supabase createUser not implemented");
}

export async function updateUser(
  id: string,
  data: Partial<User>
): Promise<User | null> {
  if (isDemoMode()) return demo.updateUser(id, data);
  throw new Error("Supabase updateUser not implemented");
}

export async function deleteUser(id: string): Promise<boolean> {
  if (isDemoMode()) return demo.deleteUser(id);
  throw new Error("Supabase deleteUser not implemented");
}

export async function listLeads(
  filters?: LeadFilters
): Promise<PaginatedResult<Lead>> {
  if (isDemoMode()) return demo.listLeads(filters);
  throw new Error("Supabase listLeads not implemented");
}

export async function getLead(id: string): Promise<Lead | null> {
  if (isDemoMode()) return demo.getLead(id);
  throw new Error("Supabase getLead not implemented");
}

export async function createLead(
  data: Omit<Lead, "id" | "created_at" | "updated_at">
): Promise<Lead> {
  if (isDemoMode()) return demo.createLead(data);
  throw new Error("Supabase createLead not implemented");
}

export async function updateLead(
  id: string,
  data: Partial<Lead>
): Promise<Lead | null> {
  if (isDemoMode()) return demo.updateLead(id, data);
  throw new Error("Supabase updateLead not implemented");
}

export async function deleteLead(id: string): Promise<boolean> {
  if (isDemoMode()) return demo.deleteLead(id);
  throw new Error("Supabase deleteLead not implemented");
}

export async function bulkUpdateLeads(
  ids: string[],
  data: Partial<Lead>
): Promise<number> {
  if (isDemoMode()) return demo.bulkUpdateLeads(ids, data);
  throw new Error("Supabase bulkUpdateLeads not implemented");
}

export async function listLeadEmails(
  leadId?: string,
  status?: string
): Promise<LeadEmail[]> {
  if (isDemoMode()) return demo.listLeadEmails(leadId, status);
  throw new Error("Supabase listLeadEmails not implemented");
}

export async function createLeadEmail(
  data: Omit<LeadEmail, "id" | "created_at">
): Promise<LeadEmail> {
  if (isDemoMode()) return demo.createLeadEmail(data);
  throw new Error("Supabase createLeadEmail not implemented");
}

export async function updateLeadEmail(
  id: string,
  data: Partial<LeadEmail>
): Promise<LeadEmail | null> {
  if (isDemoMode()) return demo.updateLeadEmail(id, data);
  throw new Error("Supabase updateLeadEmail not implemented");
}

export async function listMailConfig(): Promise<MailSequenceStep[]> {
  if (isDemoMode()) return demo.listMailConfig();
  throw new Error("Supabase listMailConfig not implemented");
}

export async function updateMailConfigStep(
  stepNumber: number,
  data: Partial<MailSequenceStep>
): Promise<MailSequenceStep | null> {
  if (isDemoMode()) return demo.updateMailConfigStep(stepNumber, data);
  throw new Error("Supabase updateMailConfigStep not implemented");
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode()) return demo.getDashboardStats();
  throw new Error("Supabase getDashboardStats not implemented");
}

export async function listActivity(
  limit?: number,
  filters?: { source?: string; assigned_to?: string; from?: string; to?: string }
): Promise<ActivityLog[]> {
  if (isDemoMode()) return demo.listActivity(limit, filters);
  throw new Error("Supabase listActivity not implemented");
}

export async function listProjects(): Promise<ClientProject[]> {
  if (isDemoMode()) return demo.listProjects();
  throw new Error("Supabase listProjects not implemented");
}

export async function getProject(id: string): Promise<ClientProject | null> {
  if (isDemoMode()) return demo.getProject(id);
  throw new Error("Supabase getProject not implemented");
}

export async function createProject(
  data: Omit<ClientProject, "id" | "created_at" | "updated_at">
): Promise<ClientProject> {
  if (isDemoMode()) return demo.createProject(data);
  throw new Error("Supabase createProject not implemented");
}

export async function updateProject(
  id: string,
  data: Partial<ClientProject>
): Promise<ClientProject | null> {
  if (isDemoMode()) return demo.updateProject(id, data);
  throw new Error("Supabase updateProject not implemented");
}

export async function advanceProjectStage(
  id: string,
  toStage: ProjectStage,
  notes: string | null,
  userId: string | null
): Promise<ClientProject | null> {
  if (isDemoMode()) return demo.advanceProjectStage(id, toStage, notes, userId);
  throw new Error("Supabase advanceProjectStage not implemented");
}

export async function listStageTransitions(
  projectId: string
): Promise<StageTransition[]> {
  if (isDemoMode()) return demo.listStageTransitions(projectId);
  throw new Error("Supabase listStageTransitions not implemented");
}

export async function listSettings(): Promise<SystemSetting[]> {
  if (isDemoMode()) return demo.listSettings();
  throw new Error("Supabase listSettings not implemented");
}

export async function upsertSetting(
  key: string,
  value: unknown,
  organizationId?: string
): Promise<SystemSetting> {
  if (isDemoMode()) return demo.upsertSetting(key, value, organizationId);
  throw new Error("Supabase upsertSetting not implemented");
}

export async function listGoogleSheets(): Promise<GoogleSheetConnection[]> {
  if (isDemoMode()) return demo.listGoogleSheets();
  throw new Error("Supabase listGoogleSheets not implemented");
}

export async function createGoogleSheet(
  data: Omit<GoogleSheetConnection, "id" | "created_at">
): Promise<GoogleSheetConnection> {
  if (isDemoMode()) return demo.createGoogleSheet(data);
  throw new Error("Supabase createGoogleSheet not implemented");
}

export async function updateGoogleSheet(
  id: string,
  data: Partial<GoogleSheetConnection>
): Promise<GoogleSheetConnection | null> {
  if (isDemoMode()) return demo.updateGoogleSheet(id, data);
  throw new Error("Supabase updateGoogleSheet not implemented");
}

export async function logActivity(
  data: Omit<ActivityLog, "id" | "created_at">
): Promise<ActivityLog> {
  if (isDemoMode()) return demo.logActivity(data);
  throw new Error("Supabase logActivity not implemented");
}

export async function listOutlookAccounts(): Promise<OutlookAccount[]> {
  if (isDemoMode()) return demo.listOutlookAccounts();
  throw new Error("Supabase listOutlookAccounts not implemented");
}
