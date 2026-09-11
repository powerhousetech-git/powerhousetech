import { STANDARD_KEYS, type AIMapping, type Client } from "./types";

/**
 * Apply the AI column mapping to raw Sheet1 rows, producing normalized clients
 * keyed by the standard keys. Any standard key with no mapping (or a missing
 * source column) becomes an empty string — never a hard error.
 */
export function applyMapping(
  rows: Record<string, string>[],
  mapping: AIMapping,
): Client[] {
  return rows.map((row) => {
    const normalized = {} as Client;
    for (const key of STANDARD_KEYS) {
      const actualCol = mapping[key];
      normalized[key] = actualCol ? row[actualCol] ?? "" : "";
    }
    return normalized;
  });
}

/** True if the mapping has at least the essentials to be usable. */
export function isMappingUsable(mapping: AIMapping): boolean {
  return Boolean(mapping.customer_name || mapping.next_follow_up_date);
}
