import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getClients } from "@/lib/data";
import { followUpBucket } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireApiUser();
  if (unauth) return unauth;
  try {
    const clients = await getClients();
    const withBucket = clients.map((c) => ({
      ...c,
      _bucket: followUpBucket(c.next_follow_up_date),
    }));
    return NextResponse.json({ clients: withBucket });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
