import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getEmployeeScores } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireApiUser();
  if (unauth) return unauth;
  try {
    const employees = await getEmployeeScores();
    return NextResponse.json({ employees });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
