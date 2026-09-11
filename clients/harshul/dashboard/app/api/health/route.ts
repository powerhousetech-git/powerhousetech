import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireApiUser();
  if (unauth) return unauth;
  try {
    return NextResponse.json(await getHealth());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
