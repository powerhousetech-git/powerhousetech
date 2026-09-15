"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useApi } from "@/components/useApi";
import { STANDARD_KEYS, type AIMapping, type HealthStatus } from "@/lib/types";
import { formatDateTime, cn } from "@/lib/utils";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-surface-light p-4 shadow-card dark:border-white/10 dark:bg-surface-dark">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const config = useApi<{ mapping: AIMapping; fetchedAt: number | null; demoMode: boolean; sheetId: string }>("/api/config");
  const health = useApi<HealthStatus>("/api/health");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">AI mapping &amp; system status</p>
      </header>

      <Panel title="AI Column Mapping (from AI_Config)">
        {config.loading || !config.data ? (
          <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Sheet: <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-white/10">{config.data.sheetId}</code>
              </span>
              <span>
                Last refresh: <b>{config.data.fetchedAt ? formatDateTime(new Date(config.data.fetchedAt).toISOString()) : "—"}</b>
              </span>
              <button onClick={() => config.refetch()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Standard Key</th>
                    <th className="px-3 py-2 font-semibold">Sheet Column</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {STANDARD_KEYS.map((key) => (
                    <tr key={key}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{key}</td>
                      <td className="px-3 py-2">
                        {config.data!.mapping[key] ? (
                          <span className="font-semibold text-slate-900 dark:text-white">{config.data!.mapping[key]}</span>
                        ) : (
                          <span className="text-slate-400">— not mapped —</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Evolution API (WhatsApp)">
          {health.loading || !health.data ? (
            <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={cn("h-3 w-3 rounded-full", health.data.evolution.ok ? "bg-emerald-500" : "bg-red-500")} />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {health.data.evolution.ok ? "Connected" : health.data.evolution.configured ? "Disconnected" : "Not configured"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">state: {health.data.evolution.state}</p>
                </div>
              </div>
              <button onClick={() => health.refetch()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                <RefreshCw className="h-3.5 w-3.5" /> Ping
              </button>
            </div>
          )}
        </Panel>

        <Panel title="n8n Workflows">
          {health.loading || !health.data ? (
            <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
          ) : (
            <ul className="space-y-1.5">
              {health.data.n8n.workflows.map((w) => (
                <li key={w.id}>
                  <a href={w.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10">
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{w.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
