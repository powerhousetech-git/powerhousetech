import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getMessages } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const messages = await getMessages();
    messages.sort((a, b) => {
      const ta = new Date(a.sent_at || a.send_at || 0).getTime();
      const tb = new Date(b.sent_at || b.send_at || 0).getTime();
      return tb - ta;
    });
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
