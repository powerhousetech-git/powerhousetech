"use client";

import { signIn } from "next-auth/react";
import { LayoutGrid } from "lucide-react";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas-light px-4 dark:bg-canvas-dark">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <LayoutGrid className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Harshul Tiles &amp; Fittings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Owner dashboard — sign in to continue
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-surface-light p-6 shadow-card dark:border-white/10 dark:bg-surface-dark">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <GoogleIcon /> Sign in with Google
          </button>
          <p className="mt-3 text-xs text-slate-400">
            Access is restricted to the authorised owner account.
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Powered by PowerhouseTech</p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.5 29.4 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.5 29.4 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 34.6 26.7 35.5 24 35.5c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.8 35.6 43.5 30.3 43.5 24c0-1.2-.1-2.3-.3-3.5z" />
    </svg>
  );
}
