import "server-only";

// Tiny in-memory TTL cache. Mapping is cached 5 min, sheet data 1 min (per spec).
// Survives across requests within a single server process.

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const value = await loader();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

export function cacheMeta(key: string): { fetchedAt: number | null } {
  const hit = store.get(key);
  // expires - ttl isn't tracked; we store fetchedAt separately below.
  return { fetchedAt: hit ? hit.expires : null };
}

// Track when the AI mapping was last refreshed (for the Settings page).
let mappingFetchedAt: number | null = null;
export function setMappingFetchedAt(ts: number) {
  mappingFetchedAt = ts;
}
export function getMappingFetchedAt(): number | null {
  return mappingFetchedAt;
}
