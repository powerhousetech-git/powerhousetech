import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getMockDashboardData } from "@/lib/mock-data";

type PageProps = {
  params: { clientSlug: string };
};

export function generateStaticParams() {
  return [
    { clientSlug: "demo" },
    { clientSlug: "luxe-glow" },
  ];
}

export function generateMetadata({ params }: PageProps) {
  const data = getMockDashboardData(params.clientSlug, "30d");
  return {
    title: `${data.spa.name} — Performance Dashboard | Powerhouse Tech`,
    description: `Automation ROI dashboard for ${data.spa.name}`,
  };
}

export default function DashboardPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-text-secondary">
          Loading dashboard…
        </div>
      }
    >
      <DashboardClient clientSlug={params.clientSlug} />
    </Suspense>
  );
}
