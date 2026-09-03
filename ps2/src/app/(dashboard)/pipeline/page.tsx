"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEAD_STATUSES } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/lib/types";

const KANBAN_COLUMNS: { key: string; label: string; statuses: LeadStatus[] }[] = [
  { key: "new", label: "New", statuses: ["new"] },
  {
    key: "sent",
    label: "Sent",
    statuses: [
      "mail_1_sent",
      "follow_up_1",
      "follow_up_2",
      "follow_up_3",
      "follow_up_4",
      "follow_up_5",
      "follow_up_6",
      "follow_up_7",
      "follow_up_8",
      "follow_up_9",
      "follow_up_10",
    ],
  },
  { key: "responded", label: "Responded", statuses: ["responded"] },
  { key: "meeting", label: "Meeting", statuses: ["meeting_scheduled"] },
  { key: "converted", label: "Converted", statuses: ["converted"] },
  { key: "discarded", label: "Discarded", statuses: ["discarded"] },
];

function LeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`mb-2 cursor-grab rounded-md border bg-white p-3 shadow-sm ${isDragging ? "opacity-50" : ""}`}
    >
      <p className="text-sm font-medium">{lead.full_name}</p>
      <p className="text-xs text-gray-500">{lead.company}</p>
      <div className="mt-2"><StatusBadge status={lead.status} /></div>
    </div>
  );
}

function KanbanColumn({
  column,
  leads,
}: {
  column: (typeof KANBAN_COLUMNS)[0];
  leads: Lead[];
}) {
  const columnLeads = leads.filter((l) => column.statuses.includes(l.status));

  return (
    <div className="flex w-64 shrink-0 flex-col rounded-lg bg-gray-100 p-3">
      <h3 className="mb-3 text-sm font-semibold text-[#1a237e]">
        {column.label} ({columnLeads.length})
      </h3>
      <SortableContext items={columnLeads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto">
          {columnLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelinePage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [funnel, setFunnel] = useState<{ label: string; count: number }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    Promise.all([
      fetch("/api/leads?pageSize=200").then((r) => r.json()),
      fetch("/api/dashboard/stats").then((r) => r.json()),
    ]).then(([leadsJson, statsJson]) => {
      if (leadsJson.success) setLeads(leadsJson.data.items);
      if (statsJson.success) setFunnel(statsJson.data.funnel);
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const targetColumn = KANBAN_COLUMNS.find((c) => c.key === over.id);
    if (!targetColumn) return;

    const newStatus = targetColumn.statuses[0];
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const activeLead = leads.find((l) => l.id === activeId);

  return (
    <>
      <Header title="Pipeline" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-hidden p-6">
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-4">
                {KANBAN_COLUMNS.map((col) => (
                  <div key={col.key} id={col.key} data-column={col.key}>
                    <KanbanColumn column={col} leads={leads} />
                  </div>
                ))}
              </div>
              <DragOverlay>
                {activeLead && (
                  <div className="rounded-md border bg-white p-3 shadow-lg">
                    <p className="text-sm font-medium">{activeLead.full_name}</p>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          <TabsContent value="funnel" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lead Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={funnel}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1a237e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
