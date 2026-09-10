import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployee,
} from "@/lib/data";
import type { Employee } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  const employees = await getEmployees();
  return NextResponse.json({ employees });
}

export async function POST(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<Employee>;
    const created = await createEmployee(body);
    return NextResponse.json({ employee: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<Employee> & { employee_id: string };
    if (!body.employee_id) {
      return NextResponse.json({ error: "employee_id required" }, { status: 400 });
    }
    const { employee_id, ...patch } = body;
    const updated = await updateEmployee(employee_id, patch);
    return NextResponse.json({ employee: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const unauth = requireApiAuth();
  if (unauth) return unauth;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteEmployee(id);
  return NextResponse.json({ ok });
}
