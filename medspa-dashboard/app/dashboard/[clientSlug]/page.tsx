import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AppointmentsSection } from "@/components/dashboard/sections/AppointmentsSection";
import { LeadPipelineSection } from "@/components/dashboard/sections/LeadPipelineSection";
import { OverviewSection } from "@/components/dashboard/sections/OverviewSection";
import { ReactivationSection } from "@/components/dashboard/sections/ReactivationSection";
import { RevenueImpactSection } from "@/components/dashboard/sections/RevenueImpactSection";
import { ReviewsSection } from "@/components/dashboard/sections/ReviewsSection";
import { fetchDashboardData } from "@/lib/data-fetcher";

type PageProps = {
  params: { clientSlug: string };
  searchParams: { range?: string };
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const data = await fetchDashboardData(
    params.clientSlug,
    searchParams.range ?? "30d"
  );
  return {
    title: `${data.spa.name} — Performance Dashboard | Powerhouse Tech`,
    description: `Automation ROI dashboard for ${data.spa.name}`,
  };
}

export default async function DashboardPage({
  params,
  searchParams,
}: PageProps) {
  const data = await fetchDashboardData(
    params.clientSlug,
    searchParams.range ?? "30d"
  );

  return (
    <Suspense fallback={null}>
      <DashboardShell data={data}>
        <OverviewSection data={data} />
        <LeadPipelineSection data={data} />
        <AppointmentsSection data={data} />
        <ReactivationSection data={data} />
        <ReviewsSection data={data} />
        <RevenueImpactSection data={data} />
      </DashboardShell>
    </Suspense>
  );
}
