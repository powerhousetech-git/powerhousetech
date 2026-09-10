import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import { webhookUrls } from "@/lib/n8n";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  return NextResponse.json({ settings: getSettings(), webhooks: webhookUrls() });
}

export async function PUT(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<Settings>;
    const settings = updateSettings(body);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
