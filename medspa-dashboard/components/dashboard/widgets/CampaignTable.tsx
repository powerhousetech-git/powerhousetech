"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatNumber, formatPct } from "@/lib/utils";
import type { ReactivationData } from "@/types/dashboard";

export interface CampaignTableProps {
  campaigns: ReactivationData["campaigns"];
}

type SortKey = "revenue" | "sent" | "booked" | "bookingRate";

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...campaigns];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
    return copy;
  }, [campaigns, sortKey, sortAsc]);

  const totals = useMemo(
    () =>
      campaigns.reduce(
        (acc, c) => ({
          sent: acc.sent + c.sent,
          booked: acc.booked + c.booked,
          revenue: acc.revenue + c.revenue,
        }),
        { sent: 0, booked: 0, revenue: 0 }
      ),
    [campaigns]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHead = ({
    label,
    column,
    align = "left",
  }: {
    label: string;
    column: SortKey;
    align?: "left" | "right";
  }) => (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-text-primary",
          align === "right" && "ml-auto"
        )}
      >
        {label}
        {sortKey === column &&
          (sortAsc ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reactivation campaigns</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-5 sm:pb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Type</TableHead>
              <SortHead label="Sent" column="sent" />
              <SortHead label="Booked" column="booked" />
              <SortHead label="Booking %" column="bookingRate" align="right" />
              <SortHead label="Revenue" column="revenue" align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium text-text-primary">{c.name}</p>
                  <p className="max-w-xs text-xs text-text-muted line-clamp-1">
                    {c.description}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{c.type}</Badge>
                </TableCell>
                <TableCell>{formatNumber(c.sent)}</TableCell>
                <TableCell>{formatNumber(c.booked)}</TableCell>
                <TableCell className="text-right">
                  {formatPct(c.bookingRate, 0)}
                </TableCell>
                <TableCell className="text-right font-medium text-accent-green">
                  {formatCurrency(c.revenue)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-surface-hover/50 font-semibold hover:bg-surface-hover/50">
              <TableCell colSpan={2} className="text-text-primary">
                Totals
              </TableCell>
              <TableCell className="text-text-primary">
                {formatNumber(totals.sent)}
              </TableCell>
              <TableCell className="text-text-primary">
                {formatNumber(totals.booked)}
              </TableCell>
              <TableCell className="text-right text-text-primary">
                {totals.sent > 0
                  ? formatPct((totals.booked / totals.sent) * 100, 1)
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-accent-green">
                {formatCurrency(totals.revenue)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
