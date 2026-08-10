"use client";

import { formatDistanceToNow } from "date-fns";
import { Download, LayoutGrid, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { DashboardTour } from "@/components/dashboard/DashboardTour";
import type { DateRange } from "@/types/dashboard";

export function TopBar({
  spaName,
  location,
  dateRange,
  lastUpdated,
}: {
  spaName: string;
  location: string;
  dateRange: DateRange;
  lastUpdated: string;
}) {
  const synced = formatDistanceToNow(new Date(lastUpdated), { addSuffix: true });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-8">
        <div className="min-w-0">
          <a
            href="/portal"
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary-light hover:underline"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            All services
          </a>
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            {spaName}
          </h1>
          <p className="text-sm text-text-secondary">{location}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-center">
          <DateRangePicker value={dateRange} />
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
            <RefreshCw className="h-3.5 w-3.5" />
            Last synced {synced}
          </span>
          <DashboardTour />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
            }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>
    </header>
  );
}
