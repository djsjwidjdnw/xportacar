import { after } from "next/server";
import Link from "next/link";
import { Gavel, Receipt, Trophy, Wallet, TrendingUp, Bell, FileText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/StatCard";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { createClient } from "@/lib/supabase/server";
import { settleEndedAuctions } from "@/lib/auctions";
import { getAppSettings } from "@/lib/settings";
import { getTranslations, resolveLocale } from "@/i18n/server";
import { auctionPhase, formatEur, formatRelativeTime } from "@/lib/utils";

const INTL_LOCALE: Record<string, string> = { en: "en-GB", de: "de-DE", fr: "fr-FR", ar: "ar-AE" };

export async function generateMetadata() {
  const [t, { biddingEnabled }] = await Promise.all([getTranslations("nav"), getAppSettings()]);
  return { title: biddingEnabled ? t("myBids") : t("myPurchases") };
}

export default async function BuyerDashboardPage() {
  const supabase = await createClient();
  const [tn, td, locale, { biddingEnabled }] = await Promise.all([
    getTranslations("nav"),
    getTranslations("dashboard"),
    resolveLocale(),
    getAppSettings(),
  ]);
  const intl = INTL_LOCALE[locale] ?? "en-GB";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Pull everything the dashboard needs in parallel. Bids are only read while
  // bidding is enabled (app_settings.bidding_enabled).
  const [
    { data: myBids },
    { data: wonAuctions },
    { data: notifications },
    { data: invoices },
    { data: savedSearches },
  ] = await Promise.all([
    biddingEnabled
      ? supabase
          .from("bids")
          .select(`
            id, amount_eur, created_at,
            auction:auctions!auction_id (
              id, current_bid_eur, end_time, status, winner_id,
              vehicle:vehicles!vehicle_id ( id, year, make, model )
            )
          `)
          .eq("bidder_id", user.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("auctions")
      .select(`
        id, current_bid_eur, buy_now_price_eur, end_time, status,
        vehicle:vehicles!vehicle_id ( id, year, make, model )
      `)
      .eq("winner_id", user.id)
      .in("status", ["sold", "ended"])
      .order("end_time", { ascending: false }),
    supabase
      .from("notifications")
      .select("id, type, title, body, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("id, auction_id, invoice_number, total_eur, status, created_at, vehicle:vehicles!vehicle_id(id, year, make, model)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_searches")
      .select("id, name, filters, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // Aggregate: active bids = distinct auctions where I've bid and the auction
  // is still genuinely live (end_time in the future, not just status='active').
  // deno-lint-ignore no-explicit-any
  const bidRows = (myBids ?? []) as any[];
  const activeAuctionIds = new Set<string>();
  const endedToSettle = new Set<string>();
  for (const b of bidRows) {
    const ph = auctionPhase(b.auction);
    if (ph === "live") activeAuctionIds.add(b.auction.id);
    else if (ph === "ended" && b.auction?.status === "active") endedToSettle.add(b.auction.id);
  }
  // Settle any of my auctions that have just expired so wins become durable
  // (winner_id + status) for next load — after the response, never blocking.
  if (endedToSettle.size > 0) {
    const ids = Array.from(endedToSettle);
    after(() => settleEndedAuctions(ids));
  }
  // deno-lint-ignore no-explicit-any
  const wonRows = (wonAuctions ?? []) as any[];
  const totalSpent = wonRows.reduce((sum, a) => sum + (a.current_bid_eur ?? a.buy_now_price_eur ?? 0), 0);
  // deno-lint-ignore no-explicit-any
  const invoiceRows = (invoices ?? []) as any[];
  const invoiceByAuction = new Map<string, { status: string; id: string }>(
    invoiceRows.map((i) => [i.auction_id as string, { status: i.status as string, id: i.id as string }]),
  );
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  // "Top bid per auction" — the highest bid the user currently has in each.
  const topBidByAuction = new Map<string, { amount: number; createdAt: string; auction: typeof bidRows[number]["auction"] }>();
  for (const b of bidRows) {
    const aid = b.auction?.id;
    if (!aid) continue;
    const cur = topBidByAuction.get(aid);
    if (!cur || b.amount_eur > cur.amount) {
      topBidByAuction.set(aid, { amount: b.amount_eur, createdAt: b.created_at, auction: b.auction });
    }
  }
  const myAuctions = Array.from(topBidByAuction.values());
  const thClass = "bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500";
  const title = biddingEnabled ? tn("myBids") : tn("myPurchases");

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Breadcrumbs className="mb-5" items={[{ label: title }]} />
        <header className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            {biddingEnabled ? <Gavel className="size-5" /> : <Receipt className="size-5" />}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">{title}</h1>
        </header>

        {/* Stats */}
        {biddingEnabled ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={td("statActiveBids")} value={String(activeAuctionIds.size)} iconName="gavel" accent="brand" />
            <StatCard label={td("statWonAuctions")} value={String(wonRows.length)} iconName="badge-euro" accent="success" />
            <StatCard label={td("statSpent")} value={formatEur(totalSpent)} iconName="badge-euro" accent="success" />
            <StatCard label={td("statUnread")} value={String(unread)} iconName="users" accent="warning" />
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label={td("statPurchases")} value={String(wonRows.length)} iconName="car" accent="brand" />
            <StatCard label={td("statSpent")} value={formatEur(totalSpent)} iconName="badge-euro" accent="success" />
            <StatCard label={td("statUnread")} value={String(unread)} iconName="users" accent="warning" />
          </section>
        )}

        {biddingEnabled ? (
          /* Active bids table (bidding enabled) */
          <section id="bids" className="mt-10 scroll-mt-24 rounded-2xl border border-grey-200 bg-white shadow-xs">
            <header className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-bold text-grey-900">{td("bidsTitle")}</h2>
              <Link href="/auctions" className="text-sm font-medium text-brand-700 hover:underline">{tn("auctions")}</Link>
            </header>
            <div className="border-t border-grey-100">
              <Table>
                <TableHeader>
                  <TableRow className={thClass}>
                    <TableHead>{td("colVehicle")}</TableHead>
                    <TableHead>{td("colTopBid")}</TableHead>
                    <TableHead>{td("colCurrent")}</TableHead>
                    <TableHead>{td("colStatus")}</TableHead>
                    <TableHead className="text-right">{td("colWhen")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAuctions.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="px-5 py-12 text-center text-grey-500">
                      {td("noBids")}{" "}
                      <Link href="/marketplace" className="text-brand-700 hover:underline">{td("browseLink")}</Link>
                    </TableCell></TableRow>
                  )}
                  {myAuctions.map((row) => {
                    const v = row.auction?.vehicle;
                    const ended = auctionPhase(row.auction) === "ended";
                    const winning = row.amount >= (row.auction?.current_bid_eur ?? 0);
                    const won = ended && (row.auction?.winner_id === user.id || winning);
                    return (
                      <TableRow key={row.auction.id} className="[&>td]:px-5 [&>td]:py-3.5">
                        <TableCell>
                          {v ? (
                            <Link href={`/auction/${row.auction.id}`} className="font-medium text-grey-900 hover:text-brand-700">
                              {v.year} {v.make} {v.model}
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatEur(row.amount)}</TableCell>
                        <TableCell className="tabular-nums text-grey-700">{formatEur(row.auction?.current_bid_eur ?? 0)}</TableCell>
                        <TableCell>
                          {won ? (
                            <Badge className="bg-success-50 text-success-700 ring-1 ring-success-100">
                              <Trophy className="size-3" /> {td("badgeWon")}
                            </Badge>
                          ) : ended ? (
                            <Badge variant="outline" className="border-grey-200 text-grey-600">{td("badgeEnded")}</Badge>
                          ) : winning ? (
                            <Badge className="bg-success-50 text-success-700 ring-1 ring-success-100">
                              <TrendingUp className="size-3" /> {td("badgeWinning")}
                            </Badge>
                          ) : (
                            <Badge className="bg-warning-50 text-warning-700 ring-1 ring-warning-100">{td("badgeOutbid")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-grey-500">
                          {formatRelativeTime(row.createdAt, intl)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : (
          /* Purchases (fixed-price marketplace) */
          <section id="purchases" className="mt-10 scroll-mt-24 rounded-2xl border border-grey-200 bg-white shadow-xs">
            <header className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-bold text-grey-900">{td("purchasesTitle")}</h2>
              <Link href="/marketplace" className="text-sm font-medium text-brand-700 hover:underline">{td("browseLink")}</Link>
            </header>
            <div className="border-t border-grey-100">
              <Table>
                <TableHeader>
                  <TableRow className={thClass}>
                    <TableHead>{td("colVehicle")}</TableHead>
                    <TableHead>{td("colPrice")}</TableHead>
                    <TableHead>{td("colStatus")}</TableHead>
                    <TableHead className="text-right">{td("colWhen")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wonRows.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="px-5 py-12 text-center text-grey-500">
                      {td("noPurchases")}{" "}
                      <Link href="/marketplace" className="text-brand-700 hover:underline">{td("browseLink")}</Link>
                    </TableCell></TableRow>
                  )}
                  {wonRows.map((a) => {
                    const v = a.vehicle;
                    const inv = invoiceByAuction.get(a.id);
                    return (
                      <TableRow key={a.id} className="[&>td]:px-5 [&>td]:py-3.5">
                        <TableCell>
                          <Link href={`/auction/${a.id}/won`} className="font-medium text-grey-900 hover:text-brand-700">
                            {v ? `${v.year} ${v.make} ${v.model}` : "—"}
                          </Link>
                          <span className="ml-2 text-xs font-medium text-brand-700">{td("viewOrder")} →</span>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatEur(a.current_bid_eur ?? a.buy_now_price_eur ?? 0)}</TableCell>
                        <TableCell>
                          {inv?.status === "paid" ? (
                            <Badge className="bg-success-50 text-success-700 ring-1 ring-success-100">{td("statusPaid")}</Badge>
                          ) : inv?.status === "cancelled" ? (
                            <Badge variant="outline" className="border-grey-200 text-grey-600">{td("statusCancelled")}</Badge>
                          ) : (
                            <Badge className="bg-warning-50 text-warning-700 ring-1 ring-warning-100">{td("statusAwaitingPayment")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-grey-500">
                          {formatRelativeTime(a.end_time, intl)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {/* Invoices */}
        {invoiceRows.length > 0 && (
          <section className="mt-8 rounded-2xl border border-grey-200 bg-white shadow-xs">
            <header className="flex items-center justify-between px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-grey-900">
                <FileText className="size-4 text-grey-500" /> {td("invoicesTitle")}
              </h2>
            </header>
            <div className="border-t border-grey-100">
              <ul className="divide-y divide-grey-100">
                {invoiceRows.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-grey-900">
                        {r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : "—"}
                      </p>
                      <p className="text-[11px] text-grey-500 font-mono">{r.invoice_number ?? r.id.slice(0, 8)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums text-grey-900">{formatEur(r.total_eur)}</span>
                      {/* Buyer-readable inline PDF (the admin invoice page redirects buyers). */}
                      <a
                        href={`/api/invoice/${r.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        {td("viewPdf")}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Saved searches */}
        {(savedSearches ?? []).length > 0 && (
          <section className="mt-8 rounded-2xl border border-grey-200 bg-white shadow-xs">
            <header className="flex items-center justify-between px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-grey-900">
                <Search className="size-4 text-grey-500" /> {td("savedSearchesTitle")}
              </h2>
            </header>
            <div className="border-t border-grey-100">
              <ul className="divide-y divide-grey-100">
                {(savedSearches ?? []).map((s) => {
                  // deno-lint-ignore no-explicit-any
                  const r = s as any;
                  const qs = new URLSearchParams(Object.entries(r.filters ?? {}).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)]));
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <p className="font-medium text-grey-900">{r.name}</p>
                      <Link
                        href={`/marketplace${qs.toString() ? `?${qs.toString()}` : ""}`}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        {td("openSearch")}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Recent activity */}
        <section className="mt-8 rounded-2xl border border-grey-200 bg-white shadow-xs">
          <header className="flex items-center justify-between px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-grey-900">
              <Bell className="size-4 text-grey-500" /> {td("recentActivity")}
            </h2>
            <Link href="/profile" className="text-sm font-medium text-brand-700 hover:underline">{tn("profile")}</Link>
          </header>
          <div className="border-t border-grey-100">
            <ul className="divide-y divide-grey-100">
              {(notifications ?? []).length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-grey-500">{td("noNotifications")}</li>
              ) : (notifications ?? []).map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className={`mt-1 grid size-7 shrink-0 place-items-center rounded-full ${
                    n.read ? "bg-grey-100 text-grey-500" : "bg-brand-50 text-brand-700"
                  }`}>
                    <Wallet className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-grey-900">{n.title}</p>
                    <p className="text-sm text-grey-600">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-grey-500">
                    {formatRelativeTime(n.created_at, intl)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
