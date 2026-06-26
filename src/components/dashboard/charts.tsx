"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMonth, fmtNum, fmtZAR, fmtZAR2, fmtZARCompact } from "@/lib/format";

const BRAND = "var(--color-brand, #c8102e)";
const GRID = "var(--border, #e5e7eb)";
const PALETTE = [
  "#c8102e",
  "#e07b39",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#14b8a6",
  "#ec4899",
];

interface MonthlyPoint {
  month: string;
  turnoverExcl: number;
  avgSpend: number;
  transactions: number;
}

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-sm">
      {children}
    </div>
  );
}

export function RevenueTrendChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={fmtMonth}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={fmtZARCompact}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <div className="font-medium">{fmtMonth(String(label))}</div>
                <div className="text-muted-foreground">
                  Turnover (excl): {fmtZAR(Number(payload[0].value))}
                </div>
              </TooltipBox>
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="turnoverExcl"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#rev)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AvgSpendTrendChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={fmtMonth}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={fmtZARCompact}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <div className="font-medium">{fmtMonth(String(label))}</div>
                <div className="text-muted-foreground">
                  Avg spend: {fmtZAR2(Number(payload[0].value))}
                </div>
              </TooltipBox>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="avgSpend"
          stroke={BRAND}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DepartmentBarChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={fmtZARCompact} tick={{ fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted, #f3f4f6)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <div className="font-medium">{payload[0].payload.name}</div>
                <div className="text-muted-foreground">
                  {fmtZAR(Number(payload[0].value))}
                </div>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="value" fill={BRAND} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChannelPieChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <div className="font-medium">{payload[0].name}</div>
                <div className="text-muted-foreground">
                  {fmtZAR(Number(payload[0].value))} (
                  {total > 0 ? ((Number(payload[0].value) / total) * 100).toFixed(1) : 0}%)
                </div>
              </TooltipBox>
            ) : null
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ChannelLegend({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <ul className="space-y-2 text-sm">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: PALETTE[i % PALETTE.length] }}
          />
          <span className="flex-1">{d.name}</span>
          <span className="text-muted-foreground tabular-nums">
            {total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%
          </span>
          <span className="tabular-nums">{fmtNum(Math.round(d.value))}</span>
        </li>
      ))}
    </ul>
  );
}
