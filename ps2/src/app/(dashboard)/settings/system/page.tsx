"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface SystemSettings {
  ai_prompt_first_email: string;
  ai_prompt_reply: string;
  ai_prompt_sentiment: string;
  n8n_webhooks: {
    send_email: string;
    sync_sheets: string;
    process_replies: string;
  };
  health: {
    api_key_configured: boolean;
    anthropic_key_configured: boolean;
    supabase_service_key_configured: boolean;
  };
}

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadSettings = async () => {
    const res = await fetch("/api/settings/system");
    const json = await res.json();
    if (json.success) setSettings(json.data);
  };

  useEffect(() => {
    if (user?.role === "pt_admin") {
      loadSettings();
    }
  }, [user]);

  if (user?.role !== "pt_admin") {
    return (
      <>
        <Header title="System Settings" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_employee"} />
        <div className="p-6 text-gray-500">You do not have permission to view this page.</div>
      </>
    );
  }

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/settings/system", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    setMessage(json.success ? "Settings saved." : json.error ?? "Failed to save");
    setSaving(false);
  };

  const healthBadge = (ok: boolean) => (
    <Badge variant={ok ? "default" : "secondary"}>
      {ok ? "Configured" : "Missing"}
    </Badge>
  );

  return (
    <>
      <Header title="System Settings" userName={user?.full_name ?? ""} userRole={user?.role ?? "pt_admin"} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!settings ? (
          <Card><CardContent className="py-10 text-center text-gray-500">Loading settings…</CardContent></Card>
        ) : (
          <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Prompt Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>First Email Prompt</Label>
              <Textarea
                rows={4}
                value={settings.ai_prompt_first_email}
                onChange={(e) =>
                  setSettings({ ...settings, ai_prompt_first_email: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Reply Draft Prompt</Label>
              <Textarea
                rows={4}
                value={settings.ai_prompt_reply}
                onChange={(e) =>
                  setSettings({ ...settings, ai_prompt_reply: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Sentiment Classification Prompt</Label>
              <Textarea
                rows={4}
                value={settings.ai_prompt_sentiment}
                onChange={(e) =>
                  setSettings({ ...settings, ai_prompt_sentiment: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">n8n Webhook URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Send Email Webhook</Label>
              <Textarea
                rows={2}
                value={settings.n8n_webhooks.send_email}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    n8n_webhooks: { ...settings.n8n_webhooks, send_email: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label>Google Sheets Sync Webhook</Label>
              <Textarea
                rows={2}
                value={settings.n8n_webhooks.sync_sheets}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    n8n_webhooks: { ...settings.n8n_webhooks, sync_sheets: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label>Reply Processing Webhook</Label>
              <Input
                value={settings.n8n_webhooks.process_replies}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    n8n_webhooks: { ...settings.n8n_webhooks, process_replies: e.target.value },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>n8n API key configured</span>
              {healthBadge(settings.health.api_key_configured)}
            </div>
            <div className="flex items-center justify-between">
              <span>Anthropic API key configured</span>
              {healthBadge(settings.health.anthropic_key_configured)}
            </div>
            <div className="flex items-center justify-between">
              <span>Supabase service role configured</span>
              {healthBadge(settings.health.supabase_service_key_configured)}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
          </>
        )}
      </div>
    </>
  );
}
