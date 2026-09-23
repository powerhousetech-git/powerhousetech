/**
 * Thin browser client for the server-side proxies (`/api/sheets`, `/api/n8n`,
 * `/api/auth`). The app password is stored in sessionStorage and sent as the
 * `x-app-token` header on every request. No Google/n8n secrets ever live in the
 * browser — they stay in the serverless functions' env vars.
 */

export const APP_TOKEN_KEY = 'app_token';
export const UNAUTHORIZED_EVENT = 'occ-unauthorized';

export class AuthError extends Error {}
export class ApiError extends Error {}

export function getAppToken(): string {
  try {
    return sessionStorage.getItem(APP_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAppToken(token: string): void {
  try {
    sessionStorage.setItem(APP_TOKEN_KEY, token);
  } catch {
    /* ignore storage errors */
  }
}

export function clearAppToken(): void {
  try {
    sessionStorage.removeItem(APP_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** POST the password to /api/auth. Returns true when accepted. */
export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
}

/**
 * Fetches a proxy endpoint with the app token attached. On 401 it clears the
 * token, broadcasts an unauthorized event (so the app can show the login), and
 * throws {@link AuthError}. Returns parsed JSON.
 */
export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'x-app-token': getAppToken(),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearAppToken();
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new AuthError('Your session has expired. Please sign in again.');
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : '') || `Request failed (${res.status}).`;
    throw new ApiError(message);
  }

  return parsed as T;
}
