import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getAIMapping, isDemoMode } from "@/lib/sheets";
import { getMappingFetchedAt } from "@/lib/cache";
import { sheetId } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireApiUser();
  if (unauth) return unauth;
  try {
    const mapping = await getAIMapping();
    return NextResponse.json({
      mapping,
      fetchedAt: getMappingFetchedAt(),
      demoMode: isDemoMode(),
      sheetId: sheetId(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
