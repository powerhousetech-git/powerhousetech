"use client";

import { useState } from "react";
import { Check, Clock, MessageCircle, NotebookPen } from "lucide-react";
import type { Employee, FollowUp } from "@/lib/types";
import { cn, formatDate, overdueDays, waLink } from "@/lib/utils";
import { FollowUpStatusBadge } from "@/components/StatusBadge";
import { Button, Field, inputClass, Modal, Spinner } from "@/components/primitives";

function dueClass(f: FollowUp): string {
  if (f.status === "done") return "text-ink-400";
  const d = overdueDays(f.due_date);
  if (d > 0) return "text-danger font-bold";
  if (d === 0) return "text-warn font-bold";
  return "text-success";
}

export function FollowUpTable({
  followUps,
  employees,
  onMarkDone,
  onSnooze,
  onReassign,
  onAddNote,
}: {
  followUps: FollowUp[];
  employees: Employee[];
  onMarkDone: (f: FollowUp) => Promise<void>;
  onSnooze: (f: FollowUp) => Promise<void>;
  onReassign: (f: FollowUp, name: string) => Promise<void>;
  onAddNote: (f: FollowUp, note: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<FollowUp | null>(null);
  const [noteText, setNoteText] = useState("");

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  if (followUps.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-white py-10 text-center text-sm text-ink-500">
        कोई follow-up नहीं मिला।
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2.5">
        {followUps.map((f) => {
          const isBusy = busy === f.ticket_id;
          const done = f.status === "done";
          return (
            <li
              key={f.ticket_id}
              className={cn(
                "rounded-2xl border bg-white p-3.5 shadow-card",
                f.status === "overdue" ? "border-danger/30" : "border-line",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FollowUpStatusBadge status={f.status} />
                  <span className="text-xs font-mono text-ink-400">{f.ticket_id}</span>
                </div>
                <span className={cn("text-xs", dueClass(f))}>
                  {overdueDays(f.due_date) > 0 && !done
                    ? `Overdue · ${formatDate(f.due_date)}`
                    : formatDate(f.due_date)}
                </span>
              </div>

              <p className="mt-1.5 text-sm font-bold text-ink-900">{f.task}</p>
              {f.description ? (
                <p className="text-xs text-ink-500">{f.description}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
                {f.customer_name ? (
                  <span className="font-semibold text-ink-700">{f.customer_name}</span>
                ) : null}
                {f.phone ? (
                  <a
                    href={waLink(f.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-success"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> {f.phone}
                  </a>
                ) : null}
                {done && f.done_by ? (
                  <span className="text-ink-400">✔ by {f.done_by}</span>
                ) : null}
              </div>

              {f.notes ? (
                <p className="mt-2 rounded-lg bg-sand-100 px-2.5 py-1.5 text-xs text-ink-600">
                  📝 {f.notes}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-ink-500">
                  <span>Assign:</span>
                  <select
                    value={f.assigned_to}
                    disabled={isBusy}
                    onChange={(e) => run(f.ticket_id, () => onReassign(f, e.target.value))}
                    className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink-900"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((e) => (
                      <option key={e.employee_id} value={e.name}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="ml-auto flex items-center gap-1.5">
                  {!done ? (
                    <>
                      <button
                        onClick={() => run(f.ticket_id, () => onSnooze(f))}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-sand-100 disabled:opacity-50"
                      >
                        <Clock className="h-3.5 w-3.5" /> Snooze 1d
                      </button>
                      <button
                        onClick={() => run(f.ticket_id, () => onMarkDone(f))}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1.5 text-xs font-bold text-white hover:brightness-95 disabled:opacity-50"
                      >
                        {isBusy ? <Spinner className="h-3 w-3" /> : <Check className="h-3.5 w-3.5" />}
                        Done <span className="opacity-80">पूरा</span>
                      </button>
                    </>
                  ) : null}
                  <button
                    onClick={() => {
                      setNoteFor(f);
                      setNoteText(f.notes || "");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-sand-100"
                  >
                    <NotebookPen className="h-3.5 w-3.5" /> Note
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title={`Add note · ${noteFor?.ticket_id ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (noteFor) await onAddNote(noteFor, noteText);
                setNoteFor(null);
              }}
            >
              Save note
            </Button>
          </>
        }
      >
        <Field label="Note" hint="Customer feedback, next step, etc.">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            className={inputClass}
            placeholder="e.g. Customer will pay balance on Friday"
          />
        </Field>
      </Modal>
    </>
  );
}
