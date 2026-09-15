import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FollowUpBucket } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST = "Asia/Kolkata";

/** Format any date-ish value to a YYYY-MM-DD key in IST. "" if unparseable. */
export function istDateKey(input?: string | Date | null): string {
  const d = input instanceof Date ? input : parseFlexibleDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function istTodayKey(): string {
  return istDateKey(new Date());
}

/** Parse ISO, DD/MM/YYYY, DD-MM-YYYY, or common formats. Returns null if invalid. */
export function parseFlexibleDate(value?: string | null): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  // ISO-ish: YYYY-MM-DD or full ISO timestamp.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY or DD-MM-YYYY (Indian convention).
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let [, dd, mm, yy] = m;
    const year = yy.length === 2 ? `20${yy}` : yy;
    const d = new Date(Number(year), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function followUpBucket(dateStr?: string | null): FollowUpBucket {
  const key = istDateKey(parseFlexibleDate(dateStr));
  if (!key) return "none";
  const today = istTodayKey();
  if (key < today) return "overdue";
  if (key === today) return "due_today";
  return "upcoming";
}

/** Whole days between a follow-up date and today (positive = overdue). */
export function overdueDays(dateStr?: string | null): number {
  const key = istDateKey(parseFlexibleDate(dateStr));
  if (!key) return 0;
  const a = new Date(`${istTodayKey()}T00:00:00`);
  const b = new Date(`${key}T00:00:00`);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function formatDate(value?: string | null): string {
  const d = parseFlexibleDate(value);
  if (!d) return value ? String(value) : "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value?: string | null): string {
  const d = parseFlexibleDate(value);
  if (!d) return value ? String(value) : "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatINR(value: number | string): string {
  const n = typeof value === "string" ? Number(value.replace(/[^\d.-]/g, "")) || 0 : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function waNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function waLink(phone: string): string {
  return `https://wa.me/${waNumber(phone)}`;
}

/** Last N IST date keys (oldest → newest), inclusive of today. */
export function lastNDateKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    keys.push(istDateKey(d));
  }
  return keys;
}
