"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { LeadEmail, Lead } from "@/lib/types";

interface DraftWithLead extends LeadEmail {
  lead?: Lead;
}

export default function ReviewDraftsPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<DraftWithLead[]>([]);
  const [editing, setEditing] = useState<DraftWithLead | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
  });

  const loadDrafts = async () => {
    const res = await fetch("/api/review-drafts");
    const json = await res.json();
    if (json.success) setDrafts(json.data);
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    await fetch(`/api/lead-emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadDrafts();
  };

  const openEdit = (draft: DraftWithLead) => {
    setEditing(draft);
    editor?.commands.setContent(draft.body.replace(/\n/g, "<br>"));
  };

  const saveEdit = async () => {
    if (!editing) return;
    await fetch(`/api/lead-emails/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: editor?.getText() ?? editing.body,
        status: "approved",
      }),
    });
    setEditing(null);
    loadDrafts();
  };

  return (
    <>
      <Header title="Review Drafts" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No drafts pending review
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {drafts.map((draft) => (
              <Card key={draft.id} className="border-l-4 border-l-[#ffc107]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {draft.lead?.full_name ?? "Unknown Lead"}
                    </CardTitle>
                    <Badge variant="outline">Step {draft.sequence_step}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">{draft.lead?.company}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium">{draft.subject}</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-600 line-clamp-4">{draft.body}</p>
                  {draft.is_ai_draft && (
                    <Badge variant="accent">AI Generated</Badge>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => handleAction(draft.id, "approved")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(draft.id, "rejected")}>
                      Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(draft)}>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Draft</DialogTitle>
          </DialogHeader>
          <div className="min-h-[300px] rounded-md border p-3">
            <EditorContent editor={editor} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save & Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
