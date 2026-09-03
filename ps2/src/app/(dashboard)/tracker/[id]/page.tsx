"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STAGES, PROJECT_STAGE_ORDER } from "@/lib/constants";
import type { ClientProject, ProjectStage, StageTransition } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = useState<ClientProject | null>(null);
  const [transitions, setTransitions] = useState<StageTransition[]>([]);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [toStage, setToStage] = useState<ProjectStage>("bid_submitted");
  const [notes, setNotes] = useState("");

  const loadProject = async () => {
    const res = await fetch(`/api/projects/${id}`);
    const json = await res.json();
    if (json.success) {
      setProject(json.data.project);
      setTransitions(json.data.transitions ?? []);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleAdvance = async () => {
    await fetch(`/api/projects/${id}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_stage: toStage, notes }),
    });
    setAdvanceOpen(false);
    setNotes("");
    loadProject();
  };

  if (!project) {
    return (
      <>
        <Header title="Project Detail" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
        <div className="p-6">Loading...</div>
      </>
    );
  }

  const currentIdx = PROJECT_STAGE_ORDER.indexOf(project.stage);

  return (
    <>
      <Header title={project.project_name} userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex gap-2">
          <Button variant="outline" onClick={() => router.push("/tracker")}>← Back to Tracker</Button>
          <Button onClick={() => setAdvanceOpen(true)}>Advance Stage</Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{project.project_name}</CardTitle>
            <p className="text-sm text-gray-500">{project.client_name}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Order Value:</span> ₹{project.order_value.toLocaleString()}</div>
              <div><span className="text-gray-500">Quotation:</span> {project.quotation_ref ?? "—"}</div>
              <div><span className="text-gray-500">Target Date:</span> {project.target_date ?? "—"}</div>
            </div>
            {project.notes && <p className="mt-4 text-sm text-gray-600">{project.notes}</p>}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Stage Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {PROJECT_STAGE_ORDER.filter((s) => s !== "on_hold").map((stage, idx) => {
                const isComplete = idx < currentIdx;
                const isCurrent = stage === project.stage;
                return (
                  <div key={stage} className="flex items-center">
                    <div className={cn(
                      "flex flex-col items-center min-w-[80px]",
                      isCurrent && "font-semibold"
                    )}>
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs",
                        isComplete ? "bg-green-500 text-white" :
                        isCurrent ? "bg-[#1a237e] text-white" :
                        "bg-gray-200 text-gray-500"
                      )}>
                        {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      <span className="mt-1 text-center text-[10px] leading-tight">
                        {PROJECT_STAGES[stage]}
                      </span>
                    </div>
                    {idx < PROJECT_STAGE_ORDER.length - 2 && (
                      <div className={cn("h-0.5 w-6", isComplete ? "bg-green-500" : "bg-gray-200")} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Stage Transitions</CardTitle></CardHeader>
          <CardContent>
            {transitions.length === 0 ? (
              <p className="text-sm text-gray-500">No transitions yet</p>
            ) : (
              <div className="space-y-3">
                {transitions.map((t) => (
                  <div key={t.id} className="border-l-2 border-[#1a237e] pl-4">
                    <p className="text-sm font-medium">
                      {t.from_stage ? PROJECT_STAGES[t.from_stage] : "—"} → {PROJECT_STAGES[t.to_stage]}
                    </p>
                    {t.notes && <p className="text-sm text-gray-600">{t.notes}</p>}
                    <p className="text-xs text-gray-400">
                      {format(new Date(t.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Current Stage</Label>
              <p className="text-sm font-medium">{PROJECT_STAGES[project.stage]}</p>
            </div>
            <div>
              <Label>New Stage</Label>
              <Select value={toStage} onValueChange={(v) => setToStage(v as ProjectStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STAGE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{PROJECT_STAGES[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={handleAdvance}>Advance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
