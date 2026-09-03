"use client";

import { useEffect, useState } from "react";
import { Mail, CheckCircle, XCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OutlookAccount } from "@/lib/types";

export default function OutlookSettingsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<OutlookAccount[]>([]);

  useEffect(() => {
    fetch("/api/settings/outlook-accounts")
      .then((r) => r.json())
      .then((j) => { if (j.success) setAccounts(j.data); });
  }, []);

  if (user?.role === "pt_admin") {
    return (
      <>
        <Header title="Outlook" userName={user?.full_name ?? ""} userRole={user?.role ?? "pt_admin"} />
        <div className="p-6 text-gray-500">You do not have permission to view this page.</div>
      </>
    );
  }

  return (
    <>
      <Header title="Outlook Accounts" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No Outlook accounts configured
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a237e]/10">
                      <Mail className="h-5 w-5 text-[#1a237e]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{account.display_name}</CardTitle>
                      <p className="text-sm text-gray-500">{account.email}</p>
                    </div>
                  </div>
                  <Badge variant={account.is_connected ? "default" : "secondary"}>
                    {account.is_connected ? (
                      <><CheckCircle className="mr-1 h-3 w-3" /> Connected</>
                    ) : (
                      <><XCircle className="mr-1 h-3 w-3" /> Disconnected</>
                    )}
                  </Badge>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Integration Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>Outlook accounts are connected via n8n workflows for automated email sequences.</p>
            <p>Each user can have one associated Outlook account for sending outreach emails.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
