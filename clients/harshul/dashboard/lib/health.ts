import "server-only";
import { sheetId, workflowLinks, n8nBaseUrl } from "./constants";
import { isDemoMode } from "./sheets";
import type { HealthStatus } from "./types";

export async function getHealth(): Promise<HealthStatus> {
  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const instance = process.env.EVOLUTION_INSTANCE_NAME || "harshul";

  let evolution: HealthStatus["evolution"] = {
    configured: false,
    ok: false,
    state: "unconfigured",
  };

  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        headers: apiKey ? { apikey: apiKey } : {},
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { instance?: { state?: string }; state?: string };
        const state = data?.instance?.state || data?.state || "unknown";
        evolution = { configured: true, ok: state === "open", state };
      } else {
        evolution = { configured: true, ok: false, state: `error_${res.status}` };
      }
    } catch (e) {
      evolution = { configured: true, ok: false, state: "unreachable", error: (e as Error).message };
    }
  }

  return {
    evolution,
    n8n: { baseUrl: n8nBaseUrl(), workflows: workflowLinks() },
    sheets: { demoMode: isDemoMode(), sheetId: sheetId() },
  };
}
