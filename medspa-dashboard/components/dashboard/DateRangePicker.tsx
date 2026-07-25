"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/types/dashboard";

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
  { value: "90d", label: "90 days" },
];

export function DateRangePicker({ value }: { value: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setRange = (range: DateRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div
      role="tablist"
      aria-label="Date range"
      className="inline-flex rounded-xl border border-border bg-surface p-1"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setRange(opt.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
              active
                ? "bg-primary text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
