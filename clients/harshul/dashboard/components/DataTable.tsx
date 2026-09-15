"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowClassName,
  empty = "No data.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowClassName?: (row: T) => string;
  empty?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (row: T) =>
      col.sortValue ? col.sortValue(row) : String((row as Record<string, unknown>)[col.key] ?? "");
    return [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return 0;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) =>
      s && s.key === key
        ? { key, dir: s.dir === 1 ? -1 : 1 }
        : { key, dir: 1 },
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-surface-light shadow-card dark:border-white/10 dark:bg-surface-dark">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn("px-3 py-2.5 font-semibold", c.className)}>
                {c.sortable ? (
                  <button
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-100"
                  >
                    {c.header}
                    {sort?.key === c.key ? (
                      sort.dir === 1 ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : null}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr key={i} className={cn(rowClassName?.(row))}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5 align-top", c.className)}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
