"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_PERMISSIONS } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

interface HeaderProps {
  title: string;
  userName: string;
  userRole: UserRole;
}

export function Header({ title, userName, userRole }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="font-serif text-xl font-semibold text-[#1a237e]">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">{userName}</div>
          <div className="text-xs text-gray-500">
            {ROLE_PERMISSIONS[userRole]?.label ?? userRole}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
