"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DemoModeBanner } from "@/components/dashboard/DemoModeBanner";
import { Sidebar, type NavId } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import type { DashboardData } from "@/types/dashboard";

export function DashboardShell({
  data,
  children,
}: {
  data: DashboardData;
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState<NavId>("overview");

  const onNavigate = useCallback((id: NavId) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const ids: NavId[] = [
      "overview",
      "lead-pipeline",
      "appointments",
      "reactivation",
      "reviews",
      "revenue-impact",
    ];
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActiveId(id);
        },
        { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <DemoModeBanner />
      <Sidebar
        spaName={data.spa.name}
        activeId={activeId}
        onNavigate={onNavigate}
      />
      <div className="lg:pl-60">
        <TopBar
          spaName={data.spa.name}
          location={data.spa.location}
          dateRange={data.dateRange}
          lastUpdated={data.lastUpdated}
        />
        <main className="space-y-10 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
