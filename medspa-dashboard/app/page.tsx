"use client";

import { useEffect } from "react";

/** Local/dev convenience — not copied to the marketing site root on Netlify. */
export default function Home() {
  useEffect(() => {
    window.location.replace("/dashboard/demo/");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-text-secondary">
      Redirecting to demo dashboard…
    </main>
  );
}
