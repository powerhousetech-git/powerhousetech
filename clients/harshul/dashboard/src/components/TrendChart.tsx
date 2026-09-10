"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/types";

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7DED2" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#78716C" }}
            tickLine={false}
            axisLine={{ stroke: "#E7DED2" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#78716C" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E7DED2",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="sent"
            name="Messages sent"
            fill="#C2410C"
            radius={[4, 4, 0, 0]}
            barSize={22}
          />
          <Line
            dataKey="completed"
            name="Follow-ups done"
            type="monotone"
            stroke="#16A34A"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
