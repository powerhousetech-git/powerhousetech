"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface SystemSettings {
  ai_personalization?: { enabled: boolean; model: string };
  email_sequence?: { auto_send: boolean; review_required: boolean };
  n8n_webhook?: { url: string; enabled: boolean };
}

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({});
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    const res = await fetch("/api/settings/system");
    const json = await res.json();
    if (json.success) setSettings(json.data);
  };

  useEffect(() => {
    if (user?.role === "sahasra_admin" || user?.role === "pt_admin") {
      loadSettings();
    }
  }, [user]);

  if (user?.role !== "sahasra_admin" && user?.role !== "pt_admin") {
    return (
      <>
        <Header title="System Settings" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_employee"} />
        <div className="p-6 text-gray-500">You do not have permission to view this page.</div>
      </>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/settings/system", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  };

  return (
    <>
      <Header title="System Settings" userName={user?.full_name ?? ""} userRole={user?.role ?? "pt_admin"} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Personalization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.ai_personalization?.enabled ?? false}
                onCheckedChange={(v) =>
                  setSettings({
                    ...settings,
                    ai_personalization: {
                      ...settings.ai_personalization,
                      enabled: v,
                      model: settings.ai_personalization?.model ?? "claude-sonnet",
                    },
                  })
                }
              />
              <Label>Enable AI personalization for email drafts</Label>
            </div>
            <div>
              <Label>AI Model</Label>
              <Input
                value={settings.ai_personalization?.model ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai_personalization: {
                      enabled: settings.ai_personalization?.enabled ?? true,
                      model: e.target.value,
                    },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Sequence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.email_sequence?.auto_send ?? false}
                onCheckedChange={(v) =>
                  setSettings({
                    ...settings,
                    email_sequence: {
                      ...settings.email_sequence,
                      auto_send: v,
                      review_required: settings.email_sequence?.review_required ?? true,
                    },
                  })
                }
              />
              <Label>Auto-send approved emails</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.email_sequence?.review_required ?? true}
                onCheckedChange={(v) =>
                  setSettings({
                    ...settings,
                    email_sequence: {
                      auto_send: settings.email_sequence?.auto_send ?? false,
                      review_required: v,
                    },
                  })
                }
              />
              <Label>Require manual review for AI drafts</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">n8n Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.n8n_webhook?.enabled ?? false}
                onCheckedChange={(v) =>
                  setSettings({
                    ...settings,
                    n8n_webhook: {
                      url: settings.n8n_webhook?.url ?? "",
                      enabled: v,
                    },
                  })
                }
              />
              <Label>Enable n8n webhook integration</Label>
            </div>
            <div>
              <Label>Webhook URL</Label>
              <Textarea
                value={settings.n8n_webhook?.url ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    n8n_webhook: {
                      enabled: settings.n8n_webhook?.enabled ?? true,
                      url: e.target.value,
                    },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </>
  );
}
