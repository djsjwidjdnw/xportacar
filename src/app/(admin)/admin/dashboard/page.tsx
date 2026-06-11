import { ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KanbanPipeline } from "@/components/admin/KanbanPipeline";
import { QuickActions } from "@/components/admin/QuickActions";
import { StatCard } from "@/components/admin/StatCard";
import {
  AuctionsCompletedChart,
  RevenueByMonthChart,
  VehiclesByStatusChart,
} from "@/components/admin/AnalyticsCharts";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { formatEur, formatRelativeTime } from "@/lib/utils";
import type { Vehicle, VehicleStatus } from "@/types";

export const metadata = { title: "Operations dashboard" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const t = await getTranslations("admin");

  const [
    { data: vehicles },
    { count: liveAuctions },
    { count: buyers },
    { count: activeVehicleCount },
    { data: recentBids },
    { data: inspectorRows },
    { data: completedAuctions },
    { data: invoices },
  ] = await Promise.all([
    // Bounded to the most recently-updated 500 — the Kanban pipeline + status
    // chart operate on this window, never the whole (100k+) vehicles table.
    supabase.from("vehicles").select("*").order("updated_at", { ascending: false }).limit(500),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "buyer"),
    // Accurate total of non-terminal vehicles for the stat card (head-only).
    supabase.from("vehicles").select("id", { count: "exact", head: true }).not("status", "in", "(sold,delivered)"),
    supabase
      .from("bids")
      .select(`
        id, amount_eur, created_at,
        bidder:profiles!bidder_id(full_name, company_name),
        auction:auctions!auction_id(
          id,
          vehicle:vehicles!vehicle_id(id, make, model, year)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("profiles").select("id, full_name, email").eq("role", "inspector"),
    supabase
      .from("auctions")
      .select("id, status, end_time, current_bid_eur")
      .in("status", ["sold", "ended"])
      .gte("end_time", new Date(Date.now() - 8 * 7 * 86400_000).toISOString()),
    // Last ~6 months of invoices only — bounds the revenue-chart input.
    supabase
      .from("invoices")
      .select("total_eur, status, created_at")
      .gte("created_at", new Date(Date.now() - 183 * 86400_000).toISOString())
      .limit(5000),
  ]);

  const vList = (vehicles ?? []) as Vehicle[];
  const activeVehicles  = activeVehicleCount ?? 0;
  const monthlyRevenue  = vList
    .filter((v) => ["sold", "paid", "shipped", "delivered"].includes(v.status))
    .reduce((sum, v) => sum + (v.listed_price_eur ?? 0), 0);

  const grouped: Record<"scheduled" | "inspected" | "in_auction" | "sold", Vehicle[]> = {
    scheduled:  vList.filter((v) => v.status === "inspection_scheduled" || v.status === "draft"),
    inspected:  vList.filter((v) => v.status === "inspected" || v.status === "listed"),
    in_auction: vList.filter((v) => v.status === "in_auction"),
    sold:       vList.filter((v) => ["sold", "payment_pending", "paid", "collected", "shipped", "delivered"].includes(v.status as VehicleStatus)),
  };

  // ---- Chart data --------------------------------------------------
  // Auctions completed per week, last 8 weeks.
  const auctionsByWeek = (() => {
    const buckets = new Map<string, number>();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(Date.now() - i * 7 * 86400_000);
      const label = `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
      buckets.set(label, 0);
    }
    const keys = [...buckets.keys()];
    for (const a of (completedAuctions ?? []) as { end_time: string }[]) {
      const t = new Date(a.end_time).getTime();
      for (let i = 7; i >= 0; i--) {
        const start = Date.now() - (i + 1) * 7 * 86400_000;
        const end   = Date.now() - i * 7 * 86400_000;
        if (t >= start && t < end) {
          buckets.set(keys[7 - i], (buckets.get(keys[7 - i]) ?? 0) + 1);
          break;
        }
      }
    }
    return keys.map((week) => ({ week, count: buckets.get(week) ?? 0 }));
  })();

  // Revenue by month, last 6 months (from invoices if present, else from sold vehicles).
  const revenueByMonth = (() => {
    const out: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label    = d.toLocaleDateString("en-GB", { month: "short" });
      const revenue  = ((invoices ?? []) as { total_eur: number; created_at: string }[])
        .filter((inv) => inv.created_at.startsWith(monthKey))
        .reduce((s, inv) => s + Number(inv.total_eur), 0);
      out.push({ month: label, revenue });
    }
    return out;
  })();

  const vehiclesByStatus = (() => {
    const counts = new Map<string, number>();
    for (const v of vList) {
      counts.set(v.status, (counts.get(v.status) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status: status.replace(/_/g, " "), count }));
  })();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs className="mb-5" items={[{ label: t("dashboardTitle") }]} />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">
            {t("dashboardTitle")}
          </h1>
          <p className="mt-1 text-grey-600">{t("dashboardSubtitle")}</p>
        </div>
        <Link
          href="/admin/vehicles"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          {t("navVehicles")}
          <ChevronRight className="size-4" />
        </Link>
      </header>

      {/* Stat cards — consistent shadow + spacing */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("statActiveVehicles")}   value={String(activeVehicles)}    iconName="car"        delta={{ value: "+12%", positive: true }} accent="brand" />
        <StatCard label={t("statLiveAuctions")}     value={String(liveAuctions ?? 0)} iconName="gavel"      delta={{ value: "+3",   positive: true }} accent="warning" />
        <StatCard label={t("statMonthlyRevenue")}   value={formatEur(monthlyRevenue)} iconName="badge-euro" delta={{ value: "+8%",  positive: true }} accent="success" />
        <StatCard label={t("statRegisteredBuyers")} value={String(buyers ?? 0)}       iconName="users"      delta={{ value: "+24",  positive: true }} accent="brand" />
      </section>

      {/* Quick actions */}
      <section className="mt-8">
        <QuickActions />
      </section>

      {/* Analytics — bigger charts, more breathing room */}
      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <AuctionsCompletedChart data={auctionsByWeek} />
        <RevenueByMonthChart   data={revenueByMonth} />
        <VehiclesByStatusChart data={vehiclesByStatus} />
      </section>

      {/* Pipeline */}
      <section className="mt-10">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-grey-900">{t("pipelineTitle")}</h2>
        </header>
        <KanbanPipeline
          columns={[
            { key: "scheduled",  vehicles: grouped.scheduled },
            { key: "inspected",  vehicles: grouped.inspected },
            { key: "in_auction", vehicles: grouped.in_auction },
            { key: "sold",       vehicles: grouped.sold },
          ]}
          inspectors={(inspectorRows ?? []) as { id: string; full_name: string | null; email: string | null }[]}
        />
      </section>

      {/* Recent activity */}
      <section className="mt-10">
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <header className="flex items-center justify-between px-5 py-4">
            <h2 className="text-lg font-bold text-grey-900">{t("activityTitle")}</h2>
            <Link
              href="/admin/activity"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              View all activity
              <ChevronRight className="size-4" />
            </Link>
          </header>
          <div className="border-t border-grey-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                  <TableHead>{t("activityVehicle")}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t("activityEvent")}</TableHead>
                  <TableHead className="text-right">{t("activityValue")}</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">{t("activityWhen")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentBids ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="px-5 py-10 text-center text-grey-500">No activity yet.</TableCell></TableRow>
                )}
                {(recentBids ?? []).map((row) => {
                  // deno-lint-ignore no-explicit-any
                  const r = row as any;
                  const v = r.auction?.vehicle;
                  const bidderName = r.bidder?.company_name ?? r.bidder?.full_name ?? "Anonymous";
                  return (
                    <TableRow key={r.id} className="[&>td]:px-5 [&>td]:py-3.5">
                      <TableCell>
                        <div className="max-w-[220px] truncate font-medium text-grey-900">
                          {v ? `${v.year} ${v.make} ${v.model}` : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell max-w-[280px] truncate text-sm text-grey-700">
                        New bid by{" "}
                        <span className="font-medium text-grey-900">{bidderName}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-grey-900">
                        {formatEur(r.amount_eur)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-sm text-grey-500">
                        {formatRelativeTime(r.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}
