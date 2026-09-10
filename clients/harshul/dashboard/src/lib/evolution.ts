import "server-only";

// Evolution API (WhatsApp gateway) — the dashboard only checks connection
// status and surfaces the QR re-scan endpoint. It does not send messages.

export interface WhatsAppStatus {
  connected: boolean;
  state: string;
  instance: string;
  configured: boolean;
  error?: string;
}

function config() {
  return {
    baseUrl: (process.env.EVOLUTION_API_URL || "").replace(/\/$/, ""),
    apiKey: process.env.EVOLUTION_API_KEY || "",
    instance: process.env.EVOLUTION_INSTANCE_NAME || "harshul",
  };
}

export async function getConnectionState(): Promise<WhatsAppStatus> {
  const { baseUrl, apiKey, instance } = config();
  if (!baseUrl) {
    return { connected: false, state: "unconfigured", instance, configured: false };
  }
  try {
    const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
      headers: apiKey ? { apikey: apiKey } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        connected: false,
        state: `error_${res.status}`,
        instance,
        configured: true,
        error: `Evolution responded ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      instance?: { state?: string };
      state?: string;
    };
    const state = data?.instance?.state || data?.state || "unknown";
    return {
      connected: state === "open",
      state,
      instance,
      configured: true,
    };
  } catch (e) {
    return {
      connected: false,
      state: "unreachable",
      instance,
      configured: true,
      error: (e as Error).message,
    };
  }
}

export function qrEndpoint(): string {
  const { baseUrl, instance } = config();
  if (!baseUrl) return "";
  return `${baseUrl}/instance/connect/${instance}`;
}
