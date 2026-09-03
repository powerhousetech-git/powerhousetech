"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Pencil } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MailSequenceStep } from "@/lib/types";

const TEMPLATE_VARS = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{designation}}", "{{email}}"];

export default function MailConfigPage() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<MailSequenceStep[]>([]);
  const [editing, setEditing] = useState<MailSequenceStep | null>(null);
  const [subject, setSubject] = useState("");

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
  });

  const loadSteps = async () => {
    const res = await fetch("/api/mail-config");
    const json = await res.json();
    if (json.success) setSteps(json.data);
  };

  useEffect(() => {
    loadSteps();
  }, []);

  const openEdit = (step: MailSequenceStep) => {
    setEditing(step);
    setSubject(step.subject_template);
    editor?.commands.setContent(step.body_template.replace(/\n/g, "<br>"));
  };

  const saveStep = async () => {
    if (!editing) return;
    const body = editor?.getText() ?? editing.body_template;
    await fetch("/api/mail-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step_number: editing.step_number,
        subject_template: subject,
        body_template: body,
      }),
    });
    setEditing(null);
    loadSteps();
  };

  const toggleActive = async (step: MailSequenceStep) => {
    await fetch("/api/mail-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step_number: step.step_number,
        is_active: !step.is_active,
      }),
    });
    loadSteps();
  };

  const insertVar = (v: string) => {
    editor?.commands.insertContent(v);
  };

  return (
    <>
      <Header title="Mail Config" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Day Offset</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => (
                <TableRow key={step.id}>
                  <TableCell>{step.step_number}</TableCell>
                  <TableCell>{step.label}</TableCell>
                  <TableCell>{step.day_offset}</TableCell>
                  <TableCell className="max-w-xs truncate">{step.subject_template}</TableCell>
                  <TableCell>
                    <Switch checked={step.is_active} onCheckedChange={() => toggleActive(step)} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openEdit(step)}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template — Step {editing?.step_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Variables</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {TEMPLATE_VARS.map((v) => (
                  <Button key={v} size="sm" variant="outline" type="button" onClick={() => insertVar(v)}>
                    {v}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Body</Label>
              <div className="mt-1 min-h-[200px] rounded-md border p-3">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveStep}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
