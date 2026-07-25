import { getMockDashboardData } from "@/lib/mock-data";
import type { DashboardData, DateRange } from "@/types/dashboard";

function normalizeRange(range?: string): DateRange {
  if (range === "60d" || range === "90d" || range === "30d") return range;
  return "30d";
}

export async function fetchDashboardData(
  slug: string,
  dateRange?: string
): Promise<DashboardData> {
  const range = normalizeRange(dateRange);
  const api = process.env.DATA_API_URL?.trim();

  if (!api || slug === "demo" || process.env.NODE_ENV === "development") {
    // Slight delay simulates network so loading.tsx can flash in prod demos
    await new Promise((r) => setTimeout(r, 120));
    return getMockDashboardData(slug, range);
  }

  const res = await fetch(`${api}/${slug}?range=${range}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    return getMockDashboardData(slug, range);
  }
  return res.json() as Promise<DashboardData>;
}
