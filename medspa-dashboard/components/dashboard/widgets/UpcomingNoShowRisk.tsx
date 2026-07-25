"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { AppointmentData } from "@/types/dashboard";

export interface UpcomingNoShowRiskProps {
  appointments: AppointmentData["upcomingAtRisk"];
  id?: string;
}

const riskVariant = {
  high: "danger",
  medium: "warning",
  low: "success",
} as const;

export function UpcomingNoShowRisk({
  appointments,
  id = "upcoming-no-show-risk",
}: UpcomingNoShowRiskProps) {
  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>Upcoming no-show risk</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-5 sm:pb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Treatment</TableHead>
              <TableHead>Appointment</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead className="text-right">Revenue at Risk</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-text-primary">
                  {row.initials}
                </TableCell>
                <TableCell>{row.treatment}</TableCell>
                <TableCell>
                  <span className="text-text-primary">{row.appointmentDate}</span>
                  <span className="block text-xs text-text-muted">
                    {row.appointmentTime}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={riskVariant[row.riskLevel]} className="capitalize">
                    {row.riskLevel}
                  </Badge>
                  <p className="mt-1 max-w-[160px] text-xs text-text-muted">
                    {row.riskReason}
                  </p>
                </TableCell>
                <TableCell className="text-right font-mono font-medium text-accent-amber">
                  {formatCurrency(row.revenueAtRisk)}
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="sm">
                    Send Manual Reminder
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="border-t border-border px-4 py-3 text-xs text-text-muted sm:px-0">
          Risk scoring based on confirmation status, history, and booking
          recency
        </p>
      </CardContent>
    </Card>
  );
}
