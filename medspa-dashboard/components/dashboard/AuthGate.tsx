"use client";

import { useEffect, useState, type ReactNode } from "react";

declare global {
  interface Window {
    phAuthGate?: {
      waitForFirebase: () => Promise<unknown>;
      guardPage: (opts?: {
        returnTo?: string;
        eventType?: string;
        title?: string;
        record?: boolean;
      }) => Promise<unknown>;
    };
    phFirebaseAuth?: unknown;
  }
}

function loadScript(src: string, type?: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    if (type) s.type = type;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

function waitForFirebaseReady(timeoutMs = 12000) {
  if (window.phFirebaseAuth) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("Firebase auth timed out")),
      timeoutMs
    );
    window.addEventListener(
      "ph-firebase-ready",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadScript("/js/firebase-boot.js", "module");
        await loadScript("/js/auth-gate.js");
        await waitForFirebaseReady();
        const user = await window.phAuthGate?.guardPage({
          eventType: "dashboard_view",
          title: "Med Spa ROI",
        });
        if (cancelled) return;
        if (!user) {
          setBlocked(true);
          return;
        }
        setReady(true);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          window.location.replace(
            "/portal?returnTo=" +
              encodeURIComponent(
                window.location.pathname + window.location.search
              )
          );
          setBlocked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text-secondary">
        Redirecting to sign in…
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-text-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p>Verifying access…</p>
      </div>
    );
  }

  return <>{children}</>;
}
