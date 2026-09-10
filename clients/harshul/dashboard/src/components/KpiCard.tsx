import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/primitives";

export type KpiTone = "green" | "yellow" | "red" | "neutral";

const toneStyles: Record<KpiTone, string> = {
  green: "border-success/30 bg-success-bg/50",
  yellow: "border-warn/30 bg-warn-bg/50",
  red: "border-danger/30 bg-danger-bg/50",
  neutral: "border-line bg-white",
};

const toneValue: Record<KpiTone, string> = {
  green: "text-success",
  yellow: "text-warn",
  red: "text-danger",
  neutral: "text-ink-900",
};

export function KpiCard({
  label,
  hindi,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  hindi?: string;
  value: string | number;
  sub?: string;
  tone?: KpiTone;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-card",
        toneStyles[tone],
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </p>
        {icon ? <span className="text-ink-400">{icon}</span> : null}
      </div>
      <p className={cn("text-3xl font-extrabold leading-none", toneValue[tone])}>
        {value}
      </p>
      {hindi ? <p className="mt-1 text-xs text-ink-400">{hindi}</p> : null}
      {sub ? <p className="mt-1 text-xs font-medium text-ink-500">{sub}</p> : null}
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}
