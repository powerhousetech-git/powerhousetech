"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { KeyRound } from "lucide-react";
import { apiSend } from "@/lib/client";
import { Button, inputClass, Spinner } from "@/components/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiSend("/api/auth/login", "POST", { password });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.svg" alt="Harshul Tiles" width={64} height={64} className="rounded-2xl" />
          <h1 className="mt-4 text-2xl font-extrabold text-ink-900">
            Harshul Tiles &amp; Fittings
          </h1>
          <p className="text-sm text-ink-500">Dashboard · लॉगिन करें</p>
        </div>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-line bg-white p-5 shadow-card"
        >
          <label className="mb-2 block text-sm font-semibold text-ink-700">
            Password <span className="font-normal text-ink-400">(पासवर्ड)</span>
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-ink-400" />
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pl-10`}
              placeholder="••••••••"
            />
          </div>
          {error ? (
            <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full py-2.5"
          >
            {loading ? <Spinner /> : "Login"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-400">
          Powered by PowerhouseTech
        </p>
      </div>
    </main>
  );
}
