import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { markFollowUpDone } from "@/lib/data";
import { markDone as n8nMarkDone } from "@/lib/n8n";

export const dynamic = "force-dynamic";

// Marks a follow-up done: notifies n8n (best-effort) AND updates the sheet so
// the dashboard reflects it immediately even if n8n is offline.
export async function POST(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const { ticket_id, done_by, notes } = (await req.json()) as {
      ticket_id?: string;
      done_by?: string;
      notes?: string;
    };
    if (!ticket_id) {
      return NextResponse.json({ error: "ticket_id required" }, { status: 400 });
    }
    const n8n = await n8nMarkDone(ticket_id, done_by || "dashboard", notes);
    const followUp = await markFollowUpDone(ticket_id, done_by || "dashboard", notes);
    if (!followUp) {
      return NextResponse.json({ error: "follow-up not found" }, { status: 404 });
    }
    return NextResponse.json({ followUp, n8n });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
