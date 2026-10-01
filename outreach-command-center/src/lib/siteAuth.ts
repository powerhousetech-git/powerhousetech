/**
 * Bridge to the main PowerhouseTech site auth (`window.phAuthGate`, loaded via
 * /js/auth-gate.js in index.html). The Command Center is served on the main site
 * at /command-center, so it reuses the same Google sign-in + admin check instead
 * of its own password. Admin = Supabase `is_admin` (e.g. shreyas@powerhousetech.in).
 */

export interface SiteUser {
  email?: string;
  displayName?: string;
}

export interface AdminMe {
  is_admin?: boolean;
  email?: string;
}

interface PhAuthGate {
  waitForAuthUser: () => Promise<SiteUser | null>;
  fetchAdminMe: () => Promise<AdminMe>;
  getIdToken: (force?: boolean) => Promise<string | null>;
  portalSignInUrl: (returnTo?: string) => string;
  clearUser: () => void;
}

interface PhFirebaseAuth {
  auth: unknown;
  signOut: (auth: unknown) => Promise<void>;
}

declare global {
  interface Window {
    phAuthGate?: PhAuthGate;
    phFirebaseAuth?: PhFirebaseAuth;
  }
}

/** Wait (briefly) for /js/auth-gate.js to register window.phAuthGate. */
export function waitForGate(timeoutMs = 8000): Promise<PhAuthGate | null> {
  if (window.phAuthGate) return Promise.resolve(window.phAuthGate);
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      if (window.phAuthGate) {
        window.clearInterval(timer);
        resolve(window.phAuthGate);
      } else if (Date.now() - start > timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 100);
  });
}

/** Current Firebase ID token (or null if signed out). */
export async function getIdToken(force = false): Promise<string | null> {
  const gate = await waitForGate();
  if (!gate) return null;
  return gate.getIdToken(force);
}

/** Send the browser to the site sign-in, returning to /command-center after. */
export function redirectToSignIn(): void {
  const returnTo = '/command-center';
  const url = window.phAuthGate?.portalSignInUrl?.(returnTo) ?? `/portal?returnTo=${encodeURIComponent(returnTo)}`;
  window.location.replace(url);
}

/** Sign out of the site session and return to the portal. */
export async function signOutSite(): Promise<void> {
  try {
    window.phAuthGate?.clearUser?.();
    const fb = window.phFirebaseAuth;
    if (fb?.auth) await fb.signOut(fb.auth);
  } catch {
    /* ignore */
  }
  window.location.href = '/portal';
}
