import "server-only";
import type { N8nStats } from "./types";

// Thin caller for the n8n automation engine. The dashboard NEVER sends WhatsApp
// messages itself — it only pokes n8n webhooks. All calls are best-effort: if
// n8n is unreachable/unconfigured we return a soft failure so the dashboard can
// still update its own sheet state.

function base(): string | null {
  const b = process.env.N8N_WEBHOOK_BASE;
  return b ? b.replace(/\/$/, "") : null;
}

function url(path: string | undefined, fallback: string): string | null {
  const b = base();
  if (!b) return null;
  const p = (path || fallback).startsWith("/")
    ? path || fallback
    : `/${path || fallback}`;
  return `${b}${p}`;
}

export interface N8nResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  data?: unknown;
}

async function post(target: string | null, body: unknown): Promise<N8nResult> {
  if (!target) return { ok: false, skipped: true, error: "n8n not configured" };
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `n8n responded ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function markDone(
  ticket_id: string,
  done_by: string,
  notes?: string,
): Promise<N8nResult> {
  return post(url(process.env.N8N_MARK_DONE_PATH, "/hrs-mark-done"), {
    ticket_id,
    done_by,
    notes: notes || "",
  });
}

export function sendNow(
  phone: string,
  template_id: string,
  variables: Record<string, string>,
): Promise<N8nResult> {
  return post(url(process.env.N8N_SEND_NOW_PATH, "/hrs-send-now"), {
    phone,
    template_id,
    variables,
  });
}

export async function getN8nStats(): Promise<N8nStats | null> {
  const target = url(process.env.N8N_STATS_PATH, "/hrs-stats");
  if (!target) return null;
  try {
    const res = await fetch(target, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as N8nStats;
  } catch {
    return null;
  }
}

export function webhookUrls(): Record<string, string> {
  const b = base() || "(not configured)";
  return {
    "Mark Done": `${b}${process.env.N8N_MARK_DONE_PATH || "/hrs-mark-done"}`,
    "Send Now": `${b}${process.env.N8N_SEND_NOW_PATH || "/hrs-send-now"}`,
    Stats: `${b}${process.env.N8N_STATS_PATH || "/hrs-stats"}`,
  };
}
