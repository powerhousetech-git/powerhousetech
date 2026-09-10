"use client";

import type { Message } from "@/lib/types";
import { formatDateTime, truncate } from "@/lib/utils";
import { MessageStatusBadge } from "@/components/StatusBadge";

export function MessageTable({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-white py-10 text-center text-sm text-ink-500">
        कोई मैसेज नहीं मिला।
      </p>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Date/Time</th>
              <th className="px-3 py-2.5 font-semibold">Customer</th>
              <th className="px-3 py-2.5 font-semibold">Template</th>
              <th className="px-3 py-2.5 font-semibold">Preview</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Sale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {messages.map((m) => (
              <tr key={m.msg_id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-600">
                  {formatDateTime(m.sent_at || m.send_at)}
                </td>
                <td className="px-3 py-2.5 font-semibold text-ink-900">
                  {m.customer_name || m.phone}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="rounded-md bg-sand-100 px-2 py-0.5 text-xs font-mono text-ink-600">
                    {m.template_id}
                  </span>
                </td>
                <td className="max-w-xs px-3 py-2.5 text-ink-600">
                  {truncate(m.message_body, 80)}
                </td>
                <td className="px-3 py-2.5">
                  <MessageStatusBadge status={m.status} />
                  {m.status === "failed" && m.error ? (
                    <span className="ml-1 text-xs text-danger">({m.error})</span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-400">
                  {m.sale_id || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {messages.map((m) => (
          <li key={m.msg_id} className="rounded-2xl border border-line bg-white p-3 shadow-card">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-900">
                {m.customer_name || m.phone}
              </span>
              <MessageStatusBadge status={m.status} />
            </div>
            <p className="mt-1 text-sm text-ink-600">{truncate(m.message_body, 80)}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-400">
              <span className="font-mono">{m.template_id}</span>
              <span>{formatDateTime(m.sent_at || m.send_at)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
