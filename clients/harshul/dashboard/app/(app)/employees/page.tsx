"use client";

import { useApi } from "@/components/useApi";
import type { EmployeeScore } from "@/lib/types";
import { EmployeeCard } from "@/components/EmployeeCard";

export default function EmployeesPage() {
  const { data, loading, error } = useApi<{ employees: EmployeeScore[] }>("/api/employees");
  const employees = data?.employees ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Employee Scorecards</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Assignments, overdue follow-ups &amp; on-track rate</p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-surface-light py-12 text-center text-sm text-slate-400 dark:border-white/10 dark:bg-surface-dark">
          No employees found. Add rows to the Employees tab (Name, Phone, Role).
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((e) => (
            <EmployeeCard key={e.name} emp={e} />
          ))}
        </div>
      )}

      {error ? (
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
