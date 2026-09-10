import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
} from "@/lib/data";
import type { Template } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  const templates = await getTemplates();
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<Template>;
    const created = await createTemplate(body);
    return NextResponse.json({ template: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<Template> & { template_id: string };
    if (!body.template_id) {
      return NextResponse.json({ error: "template_id required" }, { status: 400 });
    }
    const { template_id, ...patch } = body;
    const updated = await updateTemplate(template_id, patch);
    return NextResponse.json({ template: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteTemplate(id);
  return NextResponse.json({ ok });
}
