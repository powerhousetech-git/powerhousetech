import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getConnectionState, qrEndpoint } from "@/lib/evolution";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  const status = await getConnectionState();
  return NextResponse.json({ status, qrEndpoint: qrEndpoint() });
}
