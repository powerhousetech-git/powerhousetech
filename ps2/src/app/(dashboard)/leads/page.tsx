"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useLegacyTable,
  getCoreRowModel,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import { Plus, Search, Trash2, Tag, UserPlus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent } from "@/components/ui/card";
import { LEAD_SOURCES } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/lib/types";

export default function LeadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    first_name: "",
    last_name: "",
    company: "",
    email: "",
    phone: "",
    source: "manual" as const,
  });

  const pageSize = 50;

  const loadLeads = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);

    const res = await fetch(`/api/leads?${params}`);
    const json = await res.json();
    if (json.success) {
      setLeads(json.data.items);
      setTotal(json.data.total);
    }
  }, [page, search, statusFilter, sourceFilter]);

  useEffect(() => {
    loadLeads();
    fetch("/api/users").then((r) => r.json()).then((j) => {
      if (j.success) setUsers(j.data);
    });
  }, [loadLeads]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const bulkAction = async (action: string, value?: string) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    if (action === "delete") {
      await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
    } else if (action === "assign" && value) {
      await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", ids, assigned_to: value }),
      });
    } else if (action === "tag" && value) {
      await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tag", ids, tag: value }),
      });
    }
    setSelectedIds(new Set());
    loadLeads();
  };

  const handleAddLead = async () => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newLead,
        full_name: `${newLead.first_name} ${newLead.last_name}`.trim(),
      }),
    });
    const json = await res.json();
    if (json.success) {
      setAddOpen(false);
      setNewLead({ first_name: "", last_name: "", company: "", email: "", phone: "", source: "manual" });
      loadLeads();
    }
  };

  const columns = useMemo<LegacyColumnDef<Lead>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={leads.length > 0 && selectedIds.size === leads.length}
            onCheckedChange={toggleAll}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => toggleSelect(row.original.id)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        accessorKey: "full_name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.full_name}</div>
            <div className="text-xs text-gray-500">{row.original.company}</div>
          </div>
        ),
      },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => LEAD_SOURCES[row.original.source] ?? row.original.source,
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ row }) => row.original.tags.join(", ") || "—",
      },
    ],
    [leads, selectedIds]
  );

  const table = useLegacyTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <Header
        title="Leads"
        userName={user?.full_name ?? ""}
        userRole={user?.role ?? "sahasra_admin"}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="mail_1_sent">Sent</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="meeting_scheduled">Meeting</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="discarded">Discarded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(LEAD_SOURCES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Lead
            </Button>
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-md border bg-white p-2">
              <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => {
                const id = prompt("Assign to user ID:");
                if (id) bulkAction("assign", id);
              }}>
                <UserPlus className="mr-1 h-3 w-3" /> Assign
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const tag = prompt("Tag to add:");
                if (tag) bulkAction("tag", tag);
              }}>
                <Tag className="mr-1 h-3 w-3" /> Tag
              </Button>
              <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-md border bg-white">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLead(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">{total} total leads</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="flex items-center text-sm">Page {page} of {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>

        {selectedLead && (
          <Card className="m-4 w-80 shrink-0 self-start">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-[#1a237e]">{selectedLead.full_name}</h3>
              <p className="text-sm text-gray-600">{selectedLead.company}</p>
              <StatusBadge status={selectedLead.status} />
              <p className="text-sm">{selectedLead.email}</p>
              <p className="text-sm">{selectedLead.phone}</p>
              <Button className="w-full" onClick={() => router.push(`/leads/${selectedLead.id}`)}>
                View Details
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={newLead.first_name} onChange={(e) => setNewLead({ ...newLead, first_name: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={newLead.last_name} onChange={(e) => setNewLead({ ...newLead, last_name: e.target.value })} /></div>
            </div>
            <div><Label>Company</Label><Input value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLead}>Create Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
