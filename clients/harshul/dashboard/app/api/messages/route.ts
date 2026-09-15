import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getMessages } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireApiUser();
  if (unauth) return unauth;
  try {
    const messages = await getMessages();
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
