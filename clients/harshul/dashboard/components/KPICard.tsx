import { cn } from "@/lib/utils";

type Tone = "brand" | "teal" | "amber" | "red" | "emerald";

const toneRing: Record<Tone, string> = {
  brand: "text-brand-600 dark:text-brand-100",
  teal: "text-teal-600 dark:text-teal-300",
  amber: "text-amber-600 dark:text-amber-300",
  red: "text-red-600 dark:text-red-300",
  emerald: "text-emerald-600 dark:text-emerald-300",
};

export function KPICard({
  label,
  value,
  icon,
  tone = "brand",
  hint,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-surface-light p-4 shadow-card dark:border-white/10 dark:bg-surface-dark">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {icon ? <span className={cn(toneRing[tone])}>{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-3xl font-extrabold", toneRing[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-surface-light p-4 shadow-card dark:border-white/10 dark:bg-surface-dark">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
    </div>
  );
}
