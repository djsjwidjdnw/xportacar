import { Mail, Clock, CalendarDays, AlertTriangle } from "lucide-react";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PrelaunchControls } from "@/components/admin/PrelaunchControls";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Pre-launch · Admin" };

type SignupRow = { email: string; ip_country: string | null; created_at: string };

export default async function AdminPrelaunchPage() {
  const supabase = await createClient();
  const now = Date.now();
  const d24 = new Date(now - 24 * 3600_000).toISOString();
  const d7 = new Date(now - 7 * 24 * 3600_000).toISOString();

  const [
    { count: total, error: totalErr },
    { count: c24 },
    { count: c7 },
    { data: recentRaw },
    { data: countryRaw },
    { data: settingsRaw },
  ] = await Promise.all([
    supabase.from("prelaunch_signups").select("*", { count: "exact", head: true }),
    supabase.from("prelaunch_signups").select("*", { count: "exact", head: true }).gte("created_at", d24),
    supabase.from("prelaunch_signups").select("*", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("prelaunch_signups").select("email, ip_country, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("prelaunch_signups").select("ip_country"),
    supabase.from("app_settings").select("key, value"),
  ]);

  const notMigrated = !!totalErr;
  const recent = (recentRaw ?? []) as SignupRow[];
  const lastSignup = recent[0]?.created_at ?? null;

  const countryCounts = new Map<string, number>();
  for (const r of (countryRaw ?? []) as { ip_country: string | null }[]) {
    const c = (r.ip_country ?? "").trim() || "Unknown";
    countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  const byCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const settings = new Map((settingsRaw ?? []).map((r) => [(r as { key: string }).key, (r as { value: unknown }).value]));
  const landingMode = settings.get("landing_mode_enabled") === true;
  const ct = settings.get("launch_countdown_target");
  const countdownTarget = typeof ct === "string" && ct ? ct : null;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">Pre-launch</h1>
        <p className="mt-1 text-grey-600">Marketing email capture, landing-page toggle, and launch countdown.</p>
      </header>

      {notMigrated && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="size-5 shrink-0" />
          Run migration <code className="mx-1 rounded bg-white px-1.5 py-0.5">025_prelaunch.sql</code> in Supabase to enable these features.
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total signups" value={String(total ?? 0)} icon={<Mail className="size-5" />} />
        <Metric label="Last 24 hours" value={String(c24 ?? 0)} icon={<Clock className="size-5" />} />
        <Metric label="Last 7 days" value={String(c7 ?? 0)} icon={<CalendarDays className="size-5" />} />
        <Metric label="Last signup" value={lastSignup ? formatRelativeTime(lastSignup) : "—"} icon={<Clock className="size-5" />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent signups */}
        <section className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <h2 className="border-b border-grey-100 px-5 py-3 text-sm font-bold text-grey-900">Recent signups</h2>
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-grey-500">No signups yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-2.5 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                  <TableHead>Email</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r, i) => (
                  <TableRow key={i} className="[&>td]:px-5 [&>td]:py-2.5">
                    <TableCell className="max-w-[220px] truncate font-medium text-grey-900">{r.email}</TableCell>
                    <TableCell className="text-grey-600">{r.ip_country ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs text-grey-500">{formatRelativeTime(r.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {/* By country */}
        <section className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <h2 className="border-b border-grey-100 px-5 py-3 text-sm font-bold text-grey-900">Signups by country</h2>
          {byCountry.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-grey-500">No data yet.</p>
          ) : (
            <ul className="divide-y divide-grey-100">
              {byCountry.map(([country, n]) => (
                <li key={country} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-grey-700">{country}</span>
                  <span className="font-semibold tabular-nums text-grey-900">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Settings + export */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-grey-900">Settings</h2>
        <PrelaunchControls landingMode={landingMode} countdownTarget={countdownTarget} />
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
      <div className="mb-2 grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>
      <p className="text-2xl font-extrabold tabular-nums text-grey-900">{value}</p>
      <p className="text-sm text-grey-500">{label}</p>
    </div>
  );
}
