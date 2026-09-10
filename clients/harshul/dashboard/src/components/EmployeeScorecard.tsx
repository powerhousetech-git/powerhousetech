import { cn } from "@/lib/utils";
import type { ScorecardRow } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warn";
  return "text-danger";
}

export function EmployeeScorecard({ rows }: { rows: ScorecardRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-500">
        अभी कोई task assign नहीं हुआ।
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Employee</th>
            <th className="px-2 py-2 text-center font-semibold">Assigned</th>
            <th className="px-2 py-2 text-center font-semibold">Done</th>
            <th className="px-2 py-2 text-center font-semibold">Overdue</th>
            <th className="px-3 py-2 text-right font-semibold">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.employee} className="bg-white">
              <td className="px-3 py-2 font-semibold text-ink-900">{r.employee}</td>
              <td className="px-2 py-2 text-center text-ink-700">{r.assigned}</td>
              <td className="px-2 py-2 text-center text-success">{r.completed}</td>
              <td
                className={cn(
                  "px-2 py-2 text-center font-semibold",
                  r.overdue > 0 ? "text-danger" : "text-ink-400",
                )}
              >
                {r.overdue}
              </td>
              <td className={cn("px-3 py-2 text-right font-extrabold", scoreColor(r.score))}>
                {r.score}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
