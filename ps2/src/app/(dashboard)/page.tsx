"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES } from "@/lib/constants";
import type { ActivityLog, DashboardStats } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [source, setSource] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");

  const loadData = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (source !== "all") params.set("source", source);
    if (assignedTo !== "all") params.set("assigned_to", assignedTo);

    const [statsRes, activityRes, usersRes] = await Promise.all([
      fetch("/api/dashboard/stats"),
      fetch(`/api/dashboard/activity?${params}`),
      fetch("/api/users"),
    ]);

    const statsJson = await statsRes.json();
    const activityJson = await activityRes.json();
    const usersJson = await usersRes.json();

    if (statsJson.success) setStats(statsJson.data);
    if (activityJson.success) setActivity(activityJson.data);
    if (usersJson.success) setUsers(usersJson.data);
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo, source, assignedTo]);

  const conversionRate =
    stats && stats.total_leads > 0
      ? `${Math.round((stats.converted_leads / stats.total_leads) * 100)}%`
      : "0%";

  const metrics = stats
    ? [
        { label: "Total Leads", value: stats.total_leads, color: "text-[#1a237e]" },
        {
          label: "Active Outreach",
          value: stats.sent_leads,
          color: "text-blue-600",
        },
        {
          label: "Responses",
          value: stats.responded_leads,
          color: "text-green-600",
        },
        {
          label: "Meetings Scheduled",
          value: stats.meetings_scheduled,
          color: "text-purple-600",
        },
        {
          label: "Conversion Rate",
          value: conversionRate,
          color: "text-emerald-600",
        },
      ]
    : [];

  return (
    <>
      <Header
        title="Dashboard"
        userName={user?.full_name ?? ""}
        userRole={user?.role ?? "sahasra_admin"}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label>From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(LEAD_SOURCES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assigned To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-5">
          {metrics.map((m) => (
            <Card key={m.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {m.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats?.funnel ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a237e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activity.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent activity</p>
                ) : (
                  activity.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 border-b border-gray-100 pb-3 last:border-0"
                    >
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ffc107]" />
                      <div>
                        <p className="text-sm text-gray-900">{item.summary}</p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
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
