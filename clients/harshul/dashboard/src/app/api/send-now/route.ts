import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { sendNow } from "@/lib/n8n";

export const dynamic = "force-dynamic";

// The dashboard does NOT send WhatsApp messages itself — it asks n8n to.
export async function POST(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const { phone, template_id, variables } = (await req.json()) as {
      phone?: string;
      template_id?: string;
      variables?: Record<string, string>;
    };
    if (!phone || !template_id) {
      return NextResponse.json(
        { error: "phone and template_id required" },
        { status: 400 },
      );
    }
    const result = await sendNow(phone, template_id, variables || {});
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
