import { redirect } from "next/navigation";
import { getSessionUser, isAuthConfigured } from "@/lib/auth";
import { isDemoMode } from "@/lib/sheets";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const demoMode = isDemoMode();
  const authConfigured = isAuthConfigured();

  return (
    <div className="min-h-screen">
      <Sidebar user={user} demoMode={demoMode} authConfigured={authConfigured} />
      <div className="lg:pl-60">
        {demoMode ? (
          <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs font-semibold text-amber-700 dark:text-amber-300">
            DEMO MODE — showing seeded sample data (no Google service account configured)
          </div>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
