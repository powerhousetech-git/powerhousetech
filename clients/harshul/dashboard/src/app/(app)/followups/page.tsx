"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { apiSend, useApi } from "@/lib/client";
import type { Employee, FollowUp } from "@/lib/types";
import { todayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FollowUpTable } from "@/components/FollowUpTable";
import { FollowUpPerformance } from "@/components/FollowUpPerformance";
import {
  Button,
  Card,
  Field,
  inputClass,
  Modal,
  SectionTitle,
  Skeleton,
} from "@/components/primitives";

type Tab = "all" | "mine" | "overdue" | "completed";
const TABS: { id: Tab; label: string; hindi: string }[] = [
  { id: "all", label: "All", hindi: "सभी" },
  { id: "mine", label: "My Tasks", hindi: "मेरे" },
  { id: "overdue", label: "Overdue", hindi: "देरी से" },
  { id: "completed", label: "Completed", hindi: "पूरे" },
];

export default function FollowUpsPage() {
  const { data, loading, refetch } = useApi<{ followUps: FollowUp[] }>("/api/followups");
  const emp = useApi<{ employees: Employee[] }>("/api/employees");
  const employees = useMemo(
    () => (emp.data?.employees ?? []).filter((e) => e.active),
    [emp.data],
  );

  const [tab, setTab] = useState<Tab>("all");
  const [currentUser, setCurrentUser] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    setCurrentUser(localStorage.getItem("hrs_current_user") || "");
  }, []);

  function pickUser(name: string) {
    setCurrentUser(name);
    localStorage.setItem("hrs_current_user", name);
  }

  const rows = useMemo(() => data?.followUps ?? [], [data]);
  const filtered = useMemo(() => {
    switch (tab) {
      case "mine":
        return rows.filter((f) => f.assigned_to === currentUser);
      case "overdue":
        return rows.filter((f) => f.status === "overdue");
      case "completed":
        return rows.filter((f) => f.status === "done");
      default:
        return rows;
    }
  }, [rows, tab, currentUser]);

  function phoneFor(name: string): string {
    return employees.find((e) => e.name === name)?.phone || "";
  }

  async function markDone(f: FollowUp) {
    await apiSend("/api/mark-done", "POST", {
      ticket_id: f.ticket_id,
      done_by: currentUser || f.assigned_to || "dashboard",
    });
    await refetch();
  }
  async function snooze(f: FollowUp) {
    await apiSend("/api/followups", "PATCH", {
      ticket_id: f.ticket_id,
      action: "snooze",
      days: 1,
    });
    await refetch();
  }
  async function reassign(f: FollowUp, name: string) {
    await apiSend("/api/followups", "PATCH", {
      ticket_id: f.ticket_id,
      assigned_to: name,
      assigned_phone: phoneFor(name),
    });
    await refetch();
  }
  async function addNote(f: FollowUp, note: string) {
    await apiSend("/api/followups", "PATCH", { ticket_id: f.ticket_id, notes: note });
    await refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Follow-Ups</h1>
          <p className="text-sm text-ink-500">फॉलो-अप · काम की सूची</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add <span className="opacity-80">जोड़ें</span>
        </Button>
      </div>

      {/* "I am" selector powers My Tasks + who completes tasks */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-500">I am:</span>
        <select
          value={currentUser}
          onChange={(e) => pickUser(e.target.value)}
          className="rounded-lg border border-line bg-white px-2 py-1 font-semibold text-ink-900"
        >
          <option value="">— select —</option>
          {employees.map((e) => (
            <option key={e.employee_id} value={e.name}>
              {e.name} ({e.role})
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              tab === t.id
                ? "bg-clay-500 text-white"
                : "bg-white text-ink-600 border border-line hover:bg-sand-100",
            )}
          >
            {t.label} <span className="opacity-70">{t.hindi}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <FollowUpTable
              followUps={filtered}
              employees={employees}
              onMarkDone={markDone}
              onSnooze={snooze}
              onReassign={reassign}
              onAddNote={addNote}
            />
          )}
        </div>
        <div className="hidden lg:block">
          <Card className="sticky top-20 p-4">
            <SectionTitle title="Performance" hindi="प्रदर्शन" />
            <FollowUpPerformance followUps={rows} />
          </Card>
        </div>
      </div>

      <AddFollowUpModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        employees={employees}
        onCreated={async () => {
          setShowAdd(false);
          await refetch();
        }}
      />
    </div>
  );
}

function AddFollowUpModal({
  open,
  onClose,
  employees,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    task: "",
    description: "",
    assigned_to: "",
    due_date: todayISO(),
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setSaving(true);
    try {
      const phone = form.phone;
      const assigned_phone = employees.find((e) => e.name === form.assigned_to)?.phone || "";
      await apiSend("/api/followups", "POST", { ...form, assigned_phone });
      setForm({ customer_name: "", phone: "", task: "", description: "", assigned_to: "", due_date: todayISO() });
      void phone;
      await onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Follow-Up · नया काम"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.task}>
            {saving ? "Saving…" : "Create"}
          </Button>
        </>
      }
    >
      <Field label="Customer name · ग्राहक">
        <input className={inputClass} value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
      </Field>
      <Field label="Phone · फ़ोन">
        <input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9425100000" />
      </Field>
      <Field label="Task · काम">
        <input className={inputClass} value={form.task} onChange={(e) => set("task", e.target.value)} placeholder="Send quotation / Collect balance…" />
      </Field>
      <Field label="Details · विवरण">
        <textarea rows={2} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Assign to · किसे">
          <select className={inputClass} value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)}>
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.employee_id} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date · तारीख">
          <input type="date" className={inputClass} value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
