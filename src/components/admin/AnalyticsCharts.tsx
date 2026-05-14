"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const PALETTE = ["#1570EF", "#039855", "#DC6803", "#D92D20", "#175CD3", "#98A2B3", "#7F56D9", "#0BA5EC"];

const eurFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function AuctionsCompletedChart({ data }: { data: { week: string; count: number }[] }) {
  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
      <h3 className="mb-1 text-sm font-bold text-grey-900">Auctions completed</h3>
      <p className="mb-4 text-xs text-grey-500">Last 8 weeks</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid stroke="#eaecf0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(21,112,239,0.06)" }} contentStyle={{ borderRadius: 8, border: "1px solid #eaecf0", fontSize: 12 }} />
          <Bar dataKey="count" fill={PALETTE[0]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueByMonthChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
      <h3 className="mb-1 text-sm font-bold text-grey-900">Revenue</h3>
      <p className="mb-4 text-xs text-grey-500">Monthly hammer + platform fee, last 6 months</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#eaecf0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #eaecf0", fontSize: 12 }}
            formatter={(v) => eurFmt.format(typeof v === "number" ? v : Number(v))}
          />
          <Line type="monotone" dataKey="revenue" stroke={PALETTE[1]} strokeWidth={3} dot={{ r: 4, fill: PALETTE[1] }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VehiclesByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
      <h3 className="mb-1 text-sm font-bold text-grey-900">Vehicles by status</h3>
      <p className="mb-4 text-xs text-grey-500">{total} vehicles total</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #eaecf0", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
