"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AppointmentsSection } from "@/components/dashboard/sections/AppointmentsSection";
import { LeadPipelineSection } from "@/components/dashboard/sections/LeadPipelineSection";
import { OverviewSection } from "@/components/dashboard/sections/OverviewSection";
import { ReactivationSection } from "@/components/dashboard/sections/ReactivationSection";
import { RevenueImpactSection } from "@/components/dashboard/sections/RevenueImpactSection";
import { ReviewsSection } from "@/components/dashboard/sections/ReviewsSection";
import { ActivityLogSection } from "@/components/dashboard/sections/ActivityLogSection";
import { getMockDashboardData } from "@/lib/mock-data";
import type { DateRange } from "@/types/dashboard";

function normalizeRange(range: string | null): DateRange {
  if (range === "60d" || range === "90d" || range === "30d") return range;
  return "30d";
}

/** Public sample dashboard — no auth gate so demos never hang on a black screen. */
export function DashboardClient({ clientSlug }: { clientSlug: string }) {
  const searchParams = useSearchParams();
  const range = normalizeRange(searchParams.get("range"));

  const data = useMemo(
    () => getMockDashboardData(clientSlug, range),
    [clientSlug, range]
  );

  return (
    <DashboardShell data={data}>
      <OverviewSection data={data} />
      <LeadPipelineSection data={data} />
      <AppointmentsSection data={data} />
      <ReactivationSection data={data} />
      <ReviewsSection data={data} />
      <RevenueImpactSection data={data} />
      <ActivityLogSection data={data} />
    </DashboardShell>
  );
}
