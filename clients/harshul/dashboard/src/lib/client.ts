"use client";

import { useCallback, useEffect, useState } from "react";

// Small client-side fetch helpers. Cookies (the auth gate) ride along
// automatically for same-origin requests.

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error((await safeError(res)) || `GET ${path} failed`);
  return res.json();
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error((await safeError(res)) || `${method} ${path} failed`);
  return res.json();
}

async function safeError(res: Response): Promise<string | null> {
  try {
    const data = await res.json();
    return (data as { error?: string }).error || null;
  } catch {
    return null;
  }
}

/** Fetch-on-mount hook with loading/error/refetch. */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<T>(path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}
