"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STAGES } from "@/lib/constants";
import type { ClientProject, ProjectStage } from "@/lib/types";

export default function TrackerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    client_name: "",
    project_name: "",
    order_value: "",
    stage: "enquiry_received" as ProjectStage,
    notes: "",
  });

  const loadProjects = async () => {
    const res = await fetch("/api/projects");
    const json = await res.json();
    if (json.success) setProjects(json.data);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async () => {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newProject,
        order_value: parseFloat(newProject.order_value) || 0,
      }),
    });
    setNewOpen(false);
    setNewProject({ client_name: "", project_name: "", order_value: "", stage: "enquiry_received", notes: "" });
    loadProjects();
  };

  const stages = Object.keys(PROJECT_STAGES) as ProjectStage[];

  return (
    <>
      <Header title="Client Tracker" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Project
          </Button>
        </div>

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => {
                const stageProjects = projects.filter((p) => p.stage === stage);
                return (
                  <div key={stage} className="w-64 shrink-0 rounded-lg bg-gray-100 p-3">
                    <h3 className="mb-3 text-sm font-semibold text-[#1a237e]">
                      {PROJECT_STAGES[stage]} ({stageProjects.length})
                    </h3>
                    {stageProjects.map((p) => (
                      <Card
                        key={p.id}
                        className="mb-2 cursor-pointer"
                        onClick={() => router.push(`/tracker/${p.id}`)}
                      >
                        <CardContent className="p-3">
                          <p className="text-sm font-medium">{p.project_name}</p>
                          <p className="text-xs text-gray-500">{p.client_name}</p>
                          <p className="mt-1 text-xs font-medium text-[#1a237e]">
                            ₹{p.order_value.toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Order Value</TableHead>
                    <TableHead>Target Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/tracker/${p.id}`)}
                    >
                      <TableCell className="font-medium">{p.project_name}</TableCell>
                      <TableCell>{p.client_name}</TableCell>
                      <TableCell>{PROJECT_STAGES[p.stage]}</TableCell>
                      <TableCell>₹{p.order_value.toLocaleString()}</TableCell>
                      <TableCell>{p.target_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Client Name</Label><Input value={newProject.client_name} onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })} /></div>
            <div><Label>Project Name</Label><Input value={newProject.project_name} onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })} /></div>
            <div><Label>Order Value (₹)</Label><Input type="number" value={newProject.order_value} onChange={(e) => setNewProject({ ...newProject, order_value: e.target.value })} /></div>
            <div>
              <Label>Stage</Label>
              <Select value={newProject.stage} onValueChange={(v) => setNewProject({ ...newProject, stage: v as ProjectStage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s} value={s}>{PROJECT_STAGES[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={newProject.notes} onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
