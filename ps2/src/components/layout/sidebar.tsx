"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Mail,
  FileText,
  Kanban,
  Settings,
  Building2,
  ClipboardList,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import { ROLE_PERMISSIONS } from "@/lib/constants";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
  hideFor?: UserRole[];
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  {
    label: "Mail Config",
    href: "/mail-config",
    icon: Mail,
    hideFor: ["sahasra_employee", "pt_admin"],
  },
  { label: "Review Drafts", href: "/review-drafts", icon: Inbox, hideFor: ["pt_admin"] },
  { label: "Client Tracker", href: "/tracker", icon: Building2, hideFor: ["pt_admin"] },
];

const settingsNav: NavItem[] = [
  {
    label: "Users",
    href: "/settings/users",
    icon: Users,
    hideFor: ["sahasra_employee", "pt_admin"],
  },
  {
    label: "Outlook",
    href: "/settings/outlook",
    icon: Mail,
    hideFor: ["pt_admin"],
  },
  {
    label: "System",
    href: "/settings/system",
    icon: Settings,
    roles: ["sahasra_admin", "pt_admin"],
  },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (role === "pt_admin") {
        return item.href === "/settings/system";
      }
      if (item.roles && !item.roles.includes(role)) return false;
      if (item.hideFor?.includes(role)) return false;
      return true;
    });

  const visibleMain = filterItems(mainNav);
  const visibleSettings = filterItems(settingsNav);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-[#1a237e] text-white">
      <div className="border-b border-white/10 p-6">
        <div className="text-2xl font-bold tracking-tight">PS2</div>
        <div className="text-sm text-[#ffc107]">Sahasra Group</div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {visibleMain.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-[#ffc107] text-[#1a237e]"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}

        {visibleSettings.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <span className="px-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                Settings
              </span>
            </div>
            {visibleSettings.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-[#ffc107] text-[#1a237e]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <ClipboardList className="h-3 w-3" />
          <FileText className="h-3 w-3" />
          <span>{ROLE_PERMISSIONS[role]?.label ?? role}</span>
        </div>
      </div>
    </aside>
  );
}
