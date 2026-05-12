import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KanbanPipeline } from "@/components/admin/KanbanPipeline";
import { StatCard } from "@/components/admin/StatCard";

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
    { data: recentBids },
  ] = await Promise.all([
    supabase.from("vehicles").select("*").order("updated_at", { ascending: false }),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "buyer"),
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
  ]);

  const vList = (vehicles ?? []) as Vehicle[];
  const activeVehicles  = vList.filter((v) => !["sold", "delivered"].includes(v.status)).length;
  const monthlyRevenue  = vList
    .filter((v) => ["sold", "paid", "shipped", "delivered"].includes(v.status))
    .reduce((sum, v) => sum + (v.listed_price_eur ?? 0), 0);

  const grouped: Record<"scheduled" | "inspected" | "in_auction" | "sold", Vehicle[]> = {
    scheduled:  vList.filter((v) => v.status === "inspection_scheduled" || v.status === "draft"),
    inspected:  vList.filter((v) => v.status === "inspected" || v.status === "listed"),
    in_auction: vList.filter((v) => v.status === "in_auction"),
    sold:       vList.filter((v) => ["sold", "payment_pending", "paid", "collected", "shipped", "delivered"].includes(v.status as VehicleStatus)),
  };

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
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

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("statActiveVehicles")}   value={String(activeVehicles)}    iconName="car"        delta={{ value: "+12%", positive: true }} accent="brand" />
        <StatCard label={t("statLiveAuctions")}     value={String(liveAuctions ?? 0)} iconName="gavel"      delta={{ value: "+3",   positive: true }} accent="warning" />
        <StatCard label={t("statMonthlyRevenue")}   value={formatEur(monthlyRevenue)} iconName="badge-euro" delta={{ value: "+8%",  positive: true }} accent="success" />
        <StatCard label={t("statRegisteredBuyers")} value={String(buyers ?? 0)}       iconName="users"      delta={{ value: "+24",  positive: true }} accent="brand" />
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
        />
      </section>

      {/* Recent activity */}
      <section className="mt-10">
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <header className="flex items-center justify-between px-5 py-4">
            <h2 className="text-lg font-bold text-grey-900">{t("activityTitle")}</h2>
            <Badge variant="outline" className="border-grey-200 text-grey-600">last 24h</Badge>
          </header>
          <div className="border-t border-grey-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                  <TableHead>{t("activityVehicle")}</TableHead>
                  <TableHead>{t("activityEvent")}</TableHead>
                  <TableHead className="text-right">{t("activityValue")}</TableHead>
                  <TableHead className="text-right">{t("activityWhen")}</TableHead>
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
                        <div className="font-medium text-grey-900">
                          {v ? `${v.year} ${v.make} ${v.model}` : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-grey-700">
                        New bid by{" "}
                        <span className="font-medium text-grey-900">{bidderName}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-grey-900">
                        {formatEur(r.amount_eur)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-grey-500">
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
