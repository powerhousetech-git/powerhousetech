"use client";

import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "@/types/dashboard";

export function ActivityLogSection({ data }: { data: DashboardData }) {
  return (
    <SectionReveal id="activity-log">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Activity / Sheet log
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Everything the automation recorded this period — contacts, reminders,
          bookings, and reviews (sample data).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation log</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-5 sm:pb-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.activityLog.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-text-muted">
                    {row.timestamp}
                  </TableCell>
                  <TableCell className="font-medium">{row.ref}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.event}</Badge>
                  </TableCell>
                  <TableCell>{row.channel}</TableCell>
                  <TableCell className="max-w-md text-text-secondary">
                    {row.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t border-border px-4 py-3 text-xs text-text-muted sm:px-0">
            In production this mirrors your automation log / sheet tab — every
            outbound message and booking outcome, auditable.
          </p>
        </CardContent>
      </Card>
    </SectionReveal>
  );
}
