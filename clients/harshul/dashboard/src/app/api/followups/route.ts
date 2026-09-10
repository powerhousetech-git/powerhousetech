import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  createFollowUp,
  getFollowUps,
  snoozeFollowUp,
  updateFollowUp,
} from "@/lib/data";
import type { FollowUp } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const followUps = await getFollowUps();
    followUps.sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );
    return NextResponse.json({ followUps });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<FollowUp>;
    const created = await createFollowUp(body);
    return NextResponse.json({ followUp: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as {
      ticket_id: string;
      action?: "snooze";
      days?: number;
    } & Partial<FollowUp>;
    if (!body.ticket_id) {
      return NextResponse.json({ error: "ticket_id required" }, { status: 400 });
    }
    if (body.action === "snooze") {
      const updated = await snoozeFollowUp(body.ticket_id, body.days ?? 1);
      return NextResponse.json({ followUp: updated });
    }
    const { ticket_id, action, days, ...patch } = body;
    void action;
    void days;
    const updated = await updateFollowUp(ticket_id, patch);
    return NextResponse.json({ followUp: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
