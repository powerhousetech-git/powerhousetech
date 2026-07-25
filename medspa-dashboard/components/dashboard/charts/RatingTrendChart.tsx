"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/utils";
import type { ReviewData } from "@/types/dashboard";

export function RatingTrendChart({
  data,
  title = "Average rating trend",
}: {
  data: ReviewData["monthlyReviews"];
  title?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#2A2A3A" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9999AA", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[4.4, 5]}
                tick={{ fill: "#9999AA", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#13131A",
                  border: "1px solid #2A2A3A",
                  borderRadius: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="avgRating"
                name="Avg rating"
                stroke={CHART_COLORS[2]}
                strokeWidth={2.5}
                dot={{ r: 4, fill: CHART_COLORS[2] }}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
