import "server-only";
import type { Settings } from "./types";

// Settings live outside the Sheets schema. Defaults come from env; runtime edits
// are held in memory (Phase 1). Phase 2 could persist these to a Settings tab.

let overrides: Partial<Settings> = {};

export function getSettings(): Settings {
  return {
    business_name: overrides.business_name ?? process.env.BUSINESS_NAME ?? "Harshul Tiles & Fittings",
    google_review_url: overrides.google_review_url ?? process.env.GOOGLE_REVIEW_URL ?? "",
    notify_9am: overrides.notify_9am ?? true,
    notify_1pm: overrides.notify_1pm ?? true,
    notify_6pm: overrides.notify_6pm ?? true,
  };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  overrides = { ...overrides, ...patch };
  return getSettings();
}
