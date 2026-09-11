"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { DashUser } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/post-sale", label: "Post-Sale", icon: Send },
  { href: "/follow-ups", label: "Follow-Ups", icon: ListChecks },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function active(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  user,
  demoMode,
  authConfigured,
}: {
  user: DashUser;
  demoMode: boolean;
  authConfigured: boolean;
}) {
  const pathname = usePathname();

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
        <LayoutGrid className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-extrabold text-white">Harshul</p>
        <p className="text-[11px] text-brand-100/80">Tiles &amp; Fittings</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand-600 lg:flex dark:bg-brand-800">
        <div className="px-5 py-4">{brand}</div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive ? "bg-white/15 text-white" : "text-brand-100/90 hover:bg-white/10",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="truncate text-xs text-brand-100/80">{user.email}</p>
            <ThemeToggle />
          </div>
          {authConfigured ? (
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-brand-100/90 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          ) : (
            <p className="px-3 text-[11px] text-brand-100/60">
              {demoMode ? "Demo mode" : "Auth disabled"}
            </p>
          )}
        </div>
      </aside>

      {/* Mobile top bar + nav */}
      <div className="sticky top-0 z-30 bg-brand-600 lg:hidden dark:bg-brand-800">
        <div className="flex items-center justify-between px-4 py-3">
          {brand}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {authConfigured ? (
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                aria-label="Sign out"
                className="rounded-lg p-2 text-brand-100 hover:bg-white/10"
              >
                <LogOut className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                  isActive ? "bg-white/20 text-white" : "text-brand-100/90 hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
