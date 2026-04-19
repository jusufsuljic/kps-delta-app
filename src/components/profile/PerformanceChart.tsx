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

import { formatSeconds } from "@/lib/format";

type PerformanceChartPoint = {
  attempt: number;
  time: number;
  createdAt: string;
  createdAtLabel: string;
  seasonName: string;
};

type PerformanceChartProps = {
  points: PerformanceChartPoint[];
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: PerformanceChartPoint;
  }>;
};

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="performance-tooltip">
      <p className="performance-tooltip__title">Attempt #{point.attempt}</p>
      <strong>{formatSeconds(point.time)}</strong>
      <span>{point.createdAtLabel}</span>
      <span>{point.seasonName}</span>
    </div>
  );
}

export function PerformanceChart({ points }: PerformanceChartProps) {
  if (points.length === 0) {
    return (
      <div className="performance-chart performance-chart--empty">
        <span>No entries yet.</span>
      </div>
    );
  }

  return (
    <div className="performance-chart">
      <div className="performance-chart__frame">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 14, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              stroke="rgba(255, 255, 255, 0.08)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="attempt"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9e9e95", fontSize: 12 }}
              tickFormatter={(value) => `#${value}`}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              tick={{ fill: "#9e9e95", fontSize: 12 }}
              tickFormatter={(value: number) => formatSeconds(value)}
            />
            <Tooltip
              cursor={{ stroke: "rgba(206, 255, 81, 0.18)", strokeWidth: 1 }}
              content={<ChartTooltip />}
            />
            <Line
              type="linear"
              dataKey="time"
              stroke="#ceff51"
              strokeWidth={3}
              dot={{ r: 4, fill: "#050505", stroke: "#ceff51", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#ceff51", stroke: "#050505", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
