"use client";

import {
  Calendar,
  DollarSign,
  LayoutDashboard,
  RefreshCw,
  Shield,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "lead-pipeline", label: "Lead Pipeline", icon: TrendingUp },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "reactivation", label: "Reactivation", icon: RefreshCw },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "revenue-impact", label: "Revenue Impact", icon: DollarSign },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]["id"];

export function Sidebar({
  spaName,
  activeId,
  onNavigate,
}: {
  spaName: string;
  activeId: NavId;
  onNavigate: (id: NavId) => void;
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface/95 backdrop-blur-md lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Powerhouse Tech</p>
            <p className="text-[11px] text-text-muted">Client ROI</p>
          </div>
        </div>
        <div className="mx-5 border-t border-border" />
        <p className="truncate px-5 py-3 text-xs text-text-secondary">{spaName}</p>
        <div className="mx-5 border-t border-border" />

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  active
                    ? "border-l-2 border-primary bg-primary/10 text-primary"
                    : "border-l-2 border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border px-5 py-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-2.5 py-1 text-[11px] font-semibold text-accent-green">
            <Shield className="h-3 w-3" />
            HIPAA Compliant
          </div>
          <p className="text-[11px] text-text-muted">Powered by Powerhouse Tech</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-6 gap-0.5 py-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[9px] font-medium",
                  active ? "text-primary" : "text-text-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
