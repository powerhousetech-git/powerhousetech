import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  createUpsellRule,
  deleteUpsellRule,
  getUpsellRules,
  updateUpsellRule,
} from "@/lib/data";
import type { UpsellRule } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  const rules = await getUpsellRules();
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<UpsellRule>;
    const created = await createUpsellRule(body);
    return NextResponse.json({ rule: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<UpsellRule> & { rule_id: string };
    if (!body.rule_id) {
      return NextResponse.json({ error: "rule_id required" }, { status: 400 });
    }
    const { rule_id, ...patch } = body;
    const updated = await updateUpsellRule(rule_id, patch);
    return NextResponse.json({ rule: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteUpsellRule(id);
  return NextResponse.json({ ok });
}
