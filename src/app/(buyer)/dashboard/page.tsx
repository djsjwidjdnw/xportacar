import Link from "next/link";
import { Gavel, Trophy, Wallet, TrendingUp, Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/StatCard";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { formatEur, formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "My bids" };

export default async function BuyerDashboardPage() {
  const supabase = await createClient();
  const t = await getTranslations("nav");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Pull everything the dashboard needs in parallel.
  const [
    { data: myBids },
    { data: wonAuctions },
    { data: notifications },
  ] = await Promise.all([
    supabase
      .from("bids")
      .select(`
        id, amount_eur, created_at,
        auction:auctions!auction_id (
          id, current_bid_eur, end_time, status, winner_id,
          vehicle:vehicles!vehicle_id ( id, year, make, model )
        )
      `)
      .eq("bidder_id", user.id)
      .order("created_at", { ascending: false }),
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
  ]);

  // Aggregate: active bids = distinct auctions where I've bid and auction is active.
  // deno-lint-ignore no-explicit-any
  const bidRows = (myBids ?? []) as any[];
  const activeAuctionIds = new Set<string>();
  let totalCommitted = 0;
  for (const b of bidRows) {
    if (b.auction?.status === "active") {
      activeAuctionIds.add(b.auction.id);
    }
  }
  // deno-lint-ignore no-explicit-any
  const wonRows = (wonAuctions ?? []) as any[];
  const totalSpent = wonRows.reduce((sum, a) => sum + (a.current_bid_eur ?? a.buy_now_price_eur ?? 0), 0);
  totalCommitted = wonRows.length + activeAuctionIds.size; // unused but tracked

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

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Gavel className="size-5" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">
            {t("myBids")}
          </h1>
        </header>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active bids" value={String(activeAuctionIds.size)} iconName="gavel" accent="brand" />
          <StatCard label="Won auctions" value={String(wonRows.length)} iconName="badge-euro" accent="success" />
          <StatCard label="Total spent" value={formatEur(totalSpent)} iconName="badge-euro" accent="success" />
          <StatCard label="Notifications" value={String((notifications ?? []).filter((n) => !n.read).length)} iconName="users" accent="warning" />
        </section>

        {/* Active bids table */}
        <section className="mt-10 rounded-2xl border border-grey-200 bg-white shadow-xs">
          <header className="flex items-center justify-between px-5 py-4">
            <h2 className="text-lg font-bold text-grey-900">Your bids</h2>
            <Link href="/auctions" className="text-sm font-medium text-brand-700 hover:underline">Live auctions</Link>
          </header>
          <div className="border-t border-grey-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Your top bid</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myAuctions.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="px-5 py-12 text-center text-grey-500">
                    No bids yet — <Link href="/marketplace" className="text-brand-700 hover:underline">browse the marketplace</Link>.
                  </TableCell></TableRow>
                )}
                {myAuctions.map((row) => {
                  const v = row.auction?.vehicle;
                  const winning = row.amount >= (row.auction?.current_bid_eur ?? 0);
                  const ended = row.auction?.status !== "active";
                  const won = row.auction?.status === "sold" && row.auction.winner_id === user.id;
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
                            <Trophy className="size-3" /> Won
                          </Badge>
                        ) : ended ? (
                          <Badge variant="outline" className="border-grey-200 text-grey-600">Ended</Badge>
                        ) : winning ? (
                          <Badge className="bg-success-50 text-success-700 ring-1 ring-success-100">
                            <TrendingUp className="size-3" /> Winning
                          </Badge>
                        ) : (
                          <Badge className="bg-warning-50 text-warning-700 ring-1 ring-warning-100">Outbid</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-grey-500">
                        {formatRelativeTime(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Recent activity */}
        <section className="mt-8 rounded-2xl border border-grey-200 bg-white shadow-xs">
          <header className="flex items-center justify-between px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-grey-900">
              <Bell className="size-4 text-grey-500" /> Recent activity
            </h2>
            <Link href="/profile" className="text-sm font-medium text-brand-700 hover:underline">Profile</Link>
          </header>
          <div className="border-t border-grey-100">
            <ul className="divide-y divide-grey-100">
              {(notifications ?? []).length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-grey-500">
                  No notifications yet.
                </li>
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
                    {formatRelativeTime(n.created_at)}
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
