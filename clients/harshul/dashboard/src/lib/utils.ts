import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Indian-format currency, e.g. ₹12,000. */
export function formatINR(value: number | string): string {
  const n = typeof value === "string" ? Number(value) || 0 : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | string): string {
  const n = typeof value === "string" ? Number(value) || 0 : value;
  return new Intl.NumberFormat("en-IN").format(n);
}

/** Parse a sheet date (YYYY-MM-DD or ISO) into a Date at local midnight. */
export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function todayISO(): string {
  return startOfDay(new Date()).toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** How overdue (in whole days) a due date is relative to today. >0 = overdue. */
export function overdueDays(dueDate: string): number {
  const due = parseDate(dueDate);
  if (!due) return 0;
  return daysBetween(new Date(), due);
}

export function formatDateTime(value: string | undefined | null): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(value: string | undefined | null): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Fill {{name}} style placeholders from a variables map. */
export function renderTemplate(
  body: string,
  vars: Record<string, string | number | undefined>,
): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? `{{${key}}}` : String(v);
  });
}

/** Normalise an Indian phone number into a wa.me-friendly digits string. */
export function waNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/${waNumber(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function truncate(str: string, len = 80): string {
  if (!str) return "";
  const clean = str.replace(/\s+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len - 1) + "…" : clean;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}
