import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Gavel, UserPlus, Car, FileText, TrendingUp,
} from "lucide-react";

import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { createClient } from "@/lib/supabase/server";
import { formatEur, formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Platform activity" };

type ActivityKind = "bid" | "registration" | "auction" | "inspection" | "invoice";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  value?: number;
  at: string;
  href?: string;
}

const META: Record<ActivityKind, { icon: typeof Gavel; label: string; accent: string }> = {
  bid:          { icon: TrendingUp, label: "Bid",          accent: "text-brand-700 bg-brand-50" },
  registration: { icon: UserPlus,   label: "Registration", accent: "text-success-700 bg-success-50" },
  auction:      { icon: Gavel,      label: "Auction",      accent: "text-warning-700 bg-warning-50" },
  inspection:   { icon: Car,        label: "Inspection",   accent: "text-grey-700 bg-grey-100" },
  invoice:      { icon: FileText,   label: "Invoice",      accent: "text-success-700 bg-success-50" },
};

export default async function AdminActivityPage() {
  const supabase = await createClient();

  const [
    { data: bids },
    { data: registrations },
    { data: auctions },
    { data: inspections },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from("bids")
      .select(`
        id, amount_eur, created_at,
        bidder:profiles!bidder_id(full_name, company_name),
        auction:auctions!auction_id(vehicle:vehicles!vehicle_id(id, make, model, year))
      `)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("profiles")
      .select("id, full_name, company_name, country, role, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("auctions")
      .select(`
        id, status, starting_price_eur, created_at,
        vehicle:vehicles!vehicle_id(id, make, model, year)
      `)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("vehicles")
      .select("id, make, model, year, status, inspection_date, created_at")
      .in("status", ["inspected", "listed", "in_auction", "pending_review"])
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("invoices")
      .select("id, invoice_number, total_eur, status, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const items: ActivityItem[] = [];

  for (const b of (bids ?? []) as any[]) {
    const v = b.auction?.vehicle;
    const who = b.bidder?.company_name ?? b.bidder?.full_name ?? "A buyer";
    items.push({
      id: `bid-${b.id}`,
      kind: "bid",
      title: v ? `${v.year} ${v.make} ${v.model}` : "Vehicle",
      detail: `New bid by ${who}`,
      value: b.amount_eur,
      at: b.created_at,
      href: v?.id ? `/admin/vehicles/${v.id}` : undefined,
    });
  }
  for (const p of (registrations ?? []) as any[]) {
    items.push({
      id: `reg-${p.id}`,
      kind: "registration",
      title: p.company_name ?? p.full_name ?? "New user",
      detail: `Registered${p.country ? ` · ${p.country}` : ""} · ${p.role}`,
      at: p.created_at,
      href: p.role === "inspector" ? "/admin/inspectors" : "/admin/users",
    });
  }
  for (const a of (auctions ?? []) as any[]) {
    const v = a.vehicle;
    items.push({
      id: `auc-${a.id}`,
      kind: "auction",
      title: v ? `${v.year} ${v.make} ${v.model}` : "Auction",
      detail: `Auction created (${a.status})`,
      value: a.starting_price_eur ?? undefined,
      at: a.created_at,
      href: v?.id ? `/admin/vehicles/${v.id}` : "/admin/auctions",
    });
  }
  for (const v of (inspections ?? []) as any[]) {
    items.push({
      id: `insp-${v.id}`,
      kind: "inspection",
      title: `${v.year} ${v.make} ${v.model}`,
      detail: `Inspection ${v.status === "pending_review" ? "submitted for review" : "completed"}`,
      at: v.inspection_date ?? v.created_at,
      href: `/admin/vehicles/${v.id}`,
    });
  }
  for (const inv of (invoices ?? []) as any[]) {
    items.push({
      id: `inv-${inv.id}`,
      kind: "invoice",
      title: inv.invoice_number ?? "Invoice",
      detail: `Invoice ${inv.status}`,
      value: inv.total_eur,
      at: inv.created_at,
      href: `/admin/invoices/${inv.id}`,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const feed = items.slice(0, 80);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs
        className="mb-5"
        items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Activity" }]}
      />
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">Platform activity</h1>
        <p className="mt-1 text-grey-600">
          Recent bids, registrations, inspections, auctions and invoices across the platform.
        </p>
      </header>

      <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
        {feed.length === 0 && (
          <p className="px-5 py-12 text-center text-grey-500">No activity yet.</p>
        )}
        <ul className="divide-y divide-grey-100">
          {feed.map((it) => {
            const meta = META[it.kind];
            const Icon = meta.icon;
            const inner = (
              <>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${meta.accent}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-grey-900">{it.title}</p>
                  <p className="truncate text-sm text-grey-600">{it.detail}</p>
                </div>
                {it.value != null && (
                  <span className="shrink-0 font-semibold tabular-nums text-grey-900">
                    {formatEur(it.value)}
                  </span>
                )}
                <span className="w-24 shrink-0 text-right text-sm text-grey-500">
                  {formatRelativeTime(it.at)}
                </span>
                {it.href && (
                  <ChevronRight className="size-4 shrink-0 text-grey-400 transition-colors group-hover:text-grey-600" />
                )}
              </>
            );
            return (
              <li key={it.id}>
                {it.href ? (
                  <Link
                    href={it.href}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-grey-50"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-3.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
