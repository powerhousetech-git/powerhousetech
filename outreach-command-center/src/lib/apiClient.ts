/**
 * Browser client for the main-site serverless proxies (`/api/sheets`,
 * `/api/n8n`). Authorization reuses the website's admin sign-in: every request
 * carries the current Firebase ID token as `Authorization: Bearer <token>`. The
 * Netlify Functions verify `is_admin` before using the server-only Google/n8n
 * secrets. No secret ever lives in the browser bundle.
 */

import { getIdToken } from './siteAuth';

export const UNAUTHORIZED_EVENT = 'occ-unauthorized';

export class AuthError extends Error {}
export class ApiError extends Error {}

export function messageFromErrorBody(parsed: unknown, status: number): string {
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    const parts = [record.error, record.message, record.hint]
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => String(value).trim());
    if (parts.length) return [...new Set(parts)].join(' — ');
  }
  if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
  return `Request failed (${status}).`;
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
}

export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new AuthError('Your session has expired or you are not authorized. Please sign in again.');
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new ApiError(messageFromErrorBody(parsed, res.status));
  }

  return parsed as T;
}
