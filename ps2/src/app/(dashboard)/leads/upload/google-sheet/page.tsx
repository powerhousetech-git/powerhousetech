"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GoogleSheetConnection } from "@/lib/types";

export default function GoogleSheetUploadPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<GoogleSheetConnection[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [tabName, setTabName] = useState("Sheet1");
  const [syncInterval, setSyncInterval] = useState("6");

  const loadConnections = async () => {
    const res = await fetch("/api/settings/google-sheet-connections");
    const json = await res.json();
    if (json.success) setConnections(json.data);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleAdd = async () => {
    await fetch("/api/settings/google-sheet-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheet_url: sheetUrl,
        tab_name: tabName,
        sync_interval_hours: parseInt(syncInterval),
      }),
    });
    setSheetUrl("");
    loadConnections();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await fetch(`/api/settings/google-sheet-connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    loadConnections();
  };

  return (
    <>
      <Header title="Google Sheet Import" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4">
          <Link href="/leads" className="text-sm text-[#1a237e] hover:underline">← Back to Leads</Link>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Connect Google Sheet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sheet URL</Label>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tab Name</Label>
                <Input value={tabName} onChange={(e) => setTabName(e.target.value)} />
              </div>
              <div>
                <Label>Sync Interval</Label>
                <Select value={syncInterval} onValueChange={setSyncInterval}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1", "3", "6", "12", "24"].map((h) => (
                      <SelectItem key={h} value={h}>{h} hours</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!sheetUrl}>Add Connection</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Active Connections</CardTitle></CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <p className="text-sm text-gray-500">No Google Sheet connections yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sheet URL</TableHead>
                    <TableHead>Tab</TableHead>
                    <TableHead>Sync</TableHead>
                    <TableHead>Last Synced</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-xs truncate">{c.sheet_url}</TableCell>
                      <TableCell>{c.tab_name}</TableCell>
                      <TableCell>{c.sync_interval_hours}h</TableCell>
                      <TableCell>{c.last_synced_at ? new Date(c.last_synced_at).toLocaleDateString() : "Never"}</TableCell>
                      <TableCell>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(v) => toggleActive(c.id, v)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
