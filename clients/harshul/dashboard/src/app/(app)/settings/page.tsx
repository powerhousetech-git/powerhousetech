"use client";

import { useEffect, useState } from "react";
import { Plus, QrCode, RefreshCw, Save, Trash2 } from "lucide-react";
import { apiSend, useApi } from "@/lib/client";
import type { Employee, EmployeeRole, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  Field,
  inputClass,
  SectionTitle,
  Skeleton,
  Spinner,
  Toggle,
} from "@/components/primitives";

interface WAStatus {
  connected: boolean;
  state: string;
  instance: string;
  configured: boolean;
}

const ROLES: EmployeeRole[] = ["Salesman", "Installer", "Admin"];

export default function SettingsPage() {
  const settingsApi = useApi<{ settings: Settings; webhooks: Record<string, string> }>("/api/settings");
  const evo = useApi<{ status: WAStatus; qrEndpoint: string }>("/api/evolution");
  const empApi = useApi<{ employees: Employee[] }>("/api/employees");

  const [form, setForm] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (settingsApi.data?.settings) setForm(settingsApi.data.settings);
  }, [settingsApi.data]);

  function setField<K extends keyof Settings>(k: K, v: Settings[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function saveSettings() {
    if (!form) return;
    setSavingSettings(true);
    try {
      await apiSend("/api/settings", "PUT", form);
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">सेटिंग्स</p>
      </div>

      {/* WhatsApp status */}
      <Card className="p-4">
        <SectionTitle title="WhatsApp" hindi="WhatsApp कनेक्शन" />
        {evo.loading ? (
          <Skeleton className="h-10" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "h-3 w-3 rounded-full",
                  evo.data?.status.connected ? "bg-success" : "bg-danger",
                )}
              />
              <div>
                <p className="text-sm font-bold text-ink-900">
                  {evo.data?.status.connected ? "Connected" : "Disconnected"}
                </p>
                <p className="text-xs text-ink-500">
                  Instance: {evo.data?.status.instance} · state: {evo.data?.status.state}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => evo.refetch()}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              {evo.data?.qrEndpoint ? (
                <a href={evo.data.qrEndpoint} target="_blank" rel="noreferrer">
                  <Button>
                    <QrCode className="h-4 w-4" /> Re-scan QR
                  </Button>
                </a>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      {/* Business config */}
      <Card className="p-4">
        <SectionTitle title="Business" hindi="व्यापार जानकारी" />
        {!form ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <Field label="Business name · used as {{business}}">
              <input className={inputClass} value={form.business_name} onChange={(e) => setField("business_name", e.target.value)} />
            </Field>
            <Field label="Google review link">
              <input className={inputClass} value={form.google_review_url} onChange={(e) => setField("google_review_url", e.target.value)} placeholder="https://g.page/r/…" />
            </Field>
            <div className="mb-3">
              <p className="mb-1.5 text-sm font-semibold text-ink-700">
                Notification schedule · डाइजेस्ट समय
              </p>
              <div className="flex flex-wrap gap-4">
                {([
                  ["notify_9am", "9 AM"],
                  ["notify_1pm", "1 PM"],
                  ["notify_6pm", "6 PM"],
                ] as [keyof Settings, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-clay-500"
                      checked={Boolean(form[key])}
                      onChange={(e) => setField(key, e.target.checked as never)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? <Spinner /> : <Save className="h-4 w-4" />} Save
            </Button>
          </>
        )}
      </Card>

      {/* Employees */}
      <Card className="p-4">
        <SectionTitle title="Employees" hindi="कर्मचारी" />
        {empApi.loading ? (
          <Skeleton className="h-32" />
        ) : (
          <EmployeeManager employees={empApi.data?.employees ?? []} onChange={() => empApi.refetch()} />
        )}
      </Card>

      {/* Webhooks (read-only) */}
      <Card className="p-4">
        <SectionTitle title="n8n Webhooks" hindi="स्वचालन (read-only)" />
        <div className="space-y-1.5 font-mono text-xs">
          {Object.entries(settingsApi.data?.webhooks ?? {}).map(([name, url]) => (
            <div key={name} className="flex flex-col rounded-lg bg-sand-100 px-3 py-2 sm:flex-row sm:items-center sm:gap-2">
              <span className="font-sans font-semibold text-ink-700">{name}:</span>
              <span className="truncate text-ink-500">{url}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EmployeeManager({
  employees,
  onChange,
}: {
  employees: Employee[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState({ name: "", phone: "", role: "Salesman" as EmployeeRole });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!adding.name) return;
    setBusy(true);
    try {
      await apiSend("/api/employees", "POST", adding);
      setAdding({ name: "", phone: "", role: "Salesman" });
      onChange();
    } finally {
      setBusy(false);
    }
  }
  async function toggle(e: Employee) {
    await apiSend("/api/employees", "PUT", { employee_id: e.employee_id, active: !e.active });
    onChange();
  }
  async function remove(e: Employee) {
    if (!confirm(`Remove ${e.name}?`)) return;
    await apiSend(`/api/employees?id=${encodeURIComponent(e.employee_id)}`, "DELETE");
    onChange();
  }

  return (
    <div>
      <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
        {employees.map((e) => (
          <li key={e.employee_id} className={cn("flex items-center gap-3 px-3 py-2.5", !e.active && "opacity-60")}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">{e.name}</p>
              <p className="text-xs text-ink-500">{e.phone || "—"} · {e.role}</p>
            </div>
            <Toggle checked={e.active} onChange={() => toggle(e)} label="active" />
            <button onClick={() => remove(e)} className="text-ink-500 hover:text-danger" aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input className={inputClass} placeholder="Name" value={adding.name} onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))} />
        <input className={inputClass} placeholder="Phone" value={adding.phone} onChange={(e) => setAdding((a) => ({ ...a, phone: e.target.value }))} />
        <select className={inputClass} value={adding.role} onChange={(e) => setAdding((a) => ({ ...a, role: e.target.value as EmployeeRole }))}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button onClick={add} disabled={busy || !adding.name}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
