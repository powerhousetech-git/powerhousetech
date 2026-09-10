import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isDemoMode } from "@/lib/sheets";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthed()) redirect("/login");
  const settings = getSettings();
  return (
    <AppShell businessName={settings.business_name} demoMode={isDemoMode()}>
      {children}
    </AppShell>
  );
}
