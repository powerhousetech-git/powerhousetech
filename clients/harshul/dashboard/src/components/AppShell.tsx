"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageCircle,
  Settings,
  TrendingUp,
} from "lucide-react";
import { apiSend } from "@/lib/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", hindi: "होम", icon: LayoutDashboard },
  { href: "/followups", label: "Follow-Ups", hindi: "फॉलो-अप", icon: ListChecks },
  { href: "/messages", label: "Messages", hindi: "मैसेज", icon: MessageCircle },
  { href: "/templates", label: "Templates", hindi: "टेम्पलेट", icon: FileText },
  { href: "/upsell", label: "Upsell", hindi: "अपसेल", icon: TrendingUp },
  { href: "/settings", label: "Settings", hindi: "सेटिंग्स", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  businessName,
  demoMode,
  children,
}: {
  businessName: string;
  demoMode: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiSend("/api/auth/logout", "POST").catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-sand-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <Image src="/logo.svg" alt="" width={36} height={36} className="rounded-lg" />
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-ink-900">Harshul</p>
            <p className="text-xs text-ink-500">Tiles &amp; Fittings</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-clay-50 text-clay-600"
                    : "text-ink-700 hover:bg-sand-100",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs font-normal text-ink-400">
                  {item.hindi}
                </span>
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-sand-100"
        >
          <LogOut className="h-5 w-5" />
          Logout <span className="text-xs font-normal text-ink-400">लॉगआउट</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <Image src="/logo.svg" alt="" width={30} height={30} className="rounded-lg" />
            <span className="text-sm font-extrabold text-ink-900">Harshul</span>
          </div>
          <div className="hidden text-sm font-semibold text-ink-700 lg:block">
            {businessName}
          </div>
          <div className="flex items-center gap-2">
            {demoMode ? (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-600">
                DEMO MODE
              </span>
            ) : null}
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-ink-500 hover:bg-sand-100 lg:hidden"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-between border-t border-line bg-white px-1 py-1.5 lg:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-semibold",
                active ? "text-clay-600" : "text-ink-500",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
