"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/status-badge";
import { SentimentBadge } from "@/components/sentiment-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lead, LeadEmail } from "@/lib/types";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [emails, setEmails] = useState<LeadEmail[]>([]);
  const [saving, setSaving] = useState(false);

  const loadLead = async () => {
    const [leadRes, emailsRes] = await Promise.all([
      fetch(`/api/leads/${id}`),
      fetch(`/api/lead-emails?lead_id=${id}`),
    ]);
    const leadJson = await leadRes.json();
    const emailsJson = await emailsRes.json();
    if (leadJson.success) setLead(leadJson.data);
    if (emailsJson.success) setEmails(emailsJson.data);
  };

  useEffect(() => {
    loadLead();
  }, [id]);

  const saveLead = async () => {
    if (!lead) return;
    setSaving(true);
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    setSaving(false);
  };

  const updateStatus = async (status: string) => {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadLead();
  };

  const handleConvert = async () => {
    await fetch(`/api/leads/${id}/convert`, { method: "POST" });
    router.push("/tracker");
  };

  const pendingDraft = emails.find((e) => e.status === "pending_review");

  if (!lead) {
    return (
      <>
        <Header title="Lead Detail" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
        <div className="p-6">Loading...</div>
      </>
    );
  }

  return (
    <>
      <Header title={lead.full_name} userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex gap-2">
          <Button variant="outline" onClick={() => router.push("/leads")}>← Back to Leads</Button>
          <Button variant="accent" onClick={() => updateStatus("meeting_scheduled")}>Schedule Meeting</Button>
          <Button onClick={handleConvert}>Mark Converted</Button>
          <Button variant="destructive" onClick={() => updateStatus("discarded")}>Discard</Button>
        </div>

        {pendingDraft && (
          <Card className="mb-6 border-[#ffc107] bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base text-[#1a237e]">Pending AI Draft Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{pendingDraft.subject}</p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{pendingDraft.body}</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={async () => {
                  await fetch(`/api/lead-emails/${pendingDraft.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "approved" }),
                  });
                  loadLead();
                }}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={async () => {
                  await fetch(`/api/lead-emails/${pendingDraft.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "rejected" }),
                  });
                  loadLead();
                }}>Reject</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Information</CardTitle>
              <StatusBadge status={lead.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name</Label><Input value={lead.first_name} onChange={(e) => setLead({ ...lead, first_name: e.target.value })} /></div>
                <div><Label>Last Name</Label><Input value={lead.last_name} onChange={(e) => setLead({ ...lead, last_name: e.target.value })} /></div>
              </div>
              <div><Label>Company</Label><Input value={lead.company} onChange={(e) => setLead({ ...lead, company: e.target.value })} /></div>
              <div><Label>Designation</Label><Input value={lead.designation} onChange={(e) => setLead({ ...lead, designation: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={lead.website} onChange={(e) => setLead({ ...lead, website: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={lead.notes ?? ""} onChange={(e) => setLead({ ...lead, notes: e.target.value })} /></div>
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
              <Button onClick={saveLead} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emails.length === 0 ? (
                  <p className="text-sm text-gray-500">No emails yet</p>
                ) : (
                  emails.map((email) => (
                    <div key={email.id} className="border-l-2 border-[#1a237e] pl-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={email.direction === "outbound" ? "default" : "secondary"}>
                          {email.direction}
                        </Badge>
                        <Badge variant="outline">{email.status}</Badge>
                        {email.sentiment && <SentimentBadge sentiment={email.sentiment} />}
                      </div>
                      <p className="mt-1 text-sm font-medium">{email.subject}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 line-clamp-3">{email.body}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {format(new Date(email.sent_at ?? email.received_at ?? email.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
