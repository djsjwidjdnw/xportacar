import Link from "next/link";
import {
  AlertCircle, CheckCircle2, CircleOff, ExternalLink, FileText, FlaskConical, KeyRound, Mail, Plug, ScanLine,
  Scale, Store,
} from "lucide-react";

import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ApifyActorField } from "@/components/admin/ApifyActorField";
import { IntegrationKeyField, type MarketKeyName } from "@/components/admin/IntegrationKeyField";
import { MarketPricesSwitch } from "@/components/admin/MarketPricesSwitch";
import { TestLookupPanel } from "@/components/admin/TestLookupPanel";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Every outside service the platform uses, its key status (last 4 characters
// only), where to get a key, and this month's usage. Market price keys are
// written here (Supabase Vault); the others are read-only rows whose keys live
// in Edge Function secrets or Vercel env.

export const metadata = { title: "Integrations · Admin" };

const KEY_SWAP_PROMPT_URL = "https://github.com/djsjwidjdnw/xportacar/blob/master/docs/integrations/KEY_SWAP_PROMPT.md";
// Estimates, from the providers' price lists (2026-10-15).
const VINCARIO_MARKET_VALUE_EUR = 1.99; // Vehicle Market Value, 100-lookup pack (from €0.90 at volume)
const VINCARIO_DECODE_EUR = 0.49;       // VIN decode, 100-lookup pack (from €0.22 at volume)

interface KeyRow { key_name: MarketKeyName; is_set: boolean; last4: string | null; updated_at: string | null }
interface EdgeKey { set: boolean; last4: string | null }
interface LookupRow {
  created_at: string; vehicle_id: string | null; service: "vincario" | "apify" | "fx"; triggered_by: string;
  success: boolean; records: number | null; est_cost: number | string; cost_currency: "EUR" | "USD"; error: string | null; duration_ms: number | null;
}
type Tone = "ok" | "off" | "warn" | "error" | "info";
interface Status { label: string; tone: Tone; detail?: string }

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) + " (Dubai)" : "—";
const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const last4Of = (v: string | undefined) => (v && v.length >= 8 ? v.slice(-4) : null);

function marketStatus(keysSet: boolean, enabled: boolean, lastFail: LookupRow | undefined, lastOk: LookupRow | undefined): Status {
  if (!keysSet) return { label: "Key missing", tone: "warn" };
  if (!enabled) return { label: "Off", tone: "off", detail: "Keys are set; switch market prices on to use them." };
  if (lastFail && (!lastOk || lastFail.created_at > lastOk.created_at)) {
    return { label: "Last error", tone: "error", detail: `${lastFail.error ?? "error"} · ${when(lastFail.created_at)}` };
  }
  if (lastOk) return { label: "Live", tone: "ok", detail: `Last lookup OK · ${when(lastOk.created_at)}` };
  return { label: "On, not tested yet", tone: "info", detail: "Run a test lookup below." };
}

const configured = (set: boolean): Status =>
  set ? { label: "Live", tone: "ok", detail: "Key configured (errors are not logged for this service)." } : { label: "Key missing", tone: "warn" };

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthName = now.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const lastOf = (service: "vincario" | "apify", success: boolean) =>
    supabase.from("market_price_lookups").select("created_at, error").eq("service", service).eq("success", success)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const [settingsRes, keysRes, edgeRes, monthRes, recentRes, decodesRes, emailsRes, vehiclesRes, vFail, vOk, aFail, aOk] = await Promise.all([
    supabase.from("app_settings").select("key, value").in("key", ["market_prices_enabled", "market_prices_apify_actor"]),
    supabase.rpc("admin_market_price_keys_status"),
    supabase.functions.invoke("market-prices", { body: { action: "status" } }),
    supabase.from("market_price_lookups").select("service, success, est_cost, cost_currency").gte("created_at", monthStart).limit(10000),
    supabase.from("market_price_lookups")
      .select("created_at, vehicle_id, service, triggered_by, success, records, est_cost, cost_currency, error, duration_ms")
      .order("created_at", { ascending: false }).limit(20),
    admin.from("vincario_usage_log").select("id", { count: "exact", head: true }).gte("called_at", monthStart),
    admin.from("automated_email_log").select("id", { count: "exact", head: true }).gte("sent_at", monthStart),
    supabase.from("vehicles").select("id, year, make, model, vin, status").order("updated_at", { ascending: false }).limit(50),
    lastOf("vincario", false), lastOf("vincario", true), lastOf("apify", false), lastOf("apify", true),
  ]);

  const settings = new Map(((settingsRes.data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  const enabled = settings.get("market_prices_enabled") === true;
  const actorRaw = settings.get("market_prices_apify_actor");
  const actor = typeof actorRaw === "string" ? actorRaw : null;

  const keys = new Map(((keysRes.data ?? []) as KeyRow[]).map((k) => [k.key_name, k]));
  const key = (n: MarketKeyName): KeyRow => keys.get(n) ?? { key_name: n, is_set: false, last4: null, updated_at: null };
  const vincarioKeysSet = key("market_vincario_api_key").is_set && key("market_vincario_secret_key").is_set;
  const apifyKeySet = key("market_apify_token").is_set;
  const keysReady = vincarioKeysSet && apifyKeySet;

  const edge = (edgeRes.error ? null : (edgeRes.data as { edge?: Record<string, EdgeKey> } | null)?.edge) ?? null;
  const edgeKey = (n: string): EdgeKey | null => (edge ? edge[n] ?? { set: false, last4: null } : null);

  const month = (monthRes.data ?? []) as Pick<LookupRow, "service" | "success" | "est_cost" | "cost_currency">[];
  const usage = (service: "vincario" | "apify") => {
    const rows = month.filter((r) => r.service === service);
    return { lookups: rows.length, failed: rows.filter((r) => !r.success).length, cost: rows.reduce((s, r) => s + Number(r.est_cost || 0), 0) };
  };
  const vUse = usage("vincario");
  const aUse = usage("apify");

  const vStatus = marketStatus(vincarioKeysSet, enabled, vFail.data as LookupRow | undefined, vOk.data as LookupRow | undefined);
  const aStatus = marketStatus(apifyKeySet, enabled, aFail.data as LookupRow | undefined, aOk.data as LookupRow | undefined);

  const resendKey = process.env.RESEND_API_KEY;
  const autodev = edgeKey("AUTODEV_API_KEY");
  const vinApi = edgeKey("VINCARIO_API_KEY");
  const vinSecret = edgeKey("VINCARIO_SECRET_KEY");
  const decodes = decodesRes.count ?? 0;

  const vehicles = ((vehiclesRes.data ?? []) as { id: string; year: number; make: string; model: string; vin: string | null; status: string }[])
    .map((v) => ({ id: v.id, label: `${v.year} ${v.make} ${v.model} · ${v.vin ?? "no VIN"} · ${v.status.replace(/_/g, " ")}` }));
  const recent = (recentRes.data ?? []) as LookupRow[];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs className="mb-5" items={[{ label: "Integrations" }]} />
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-grey-900">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Plug className="size-5" />
          </span>
          Integrations
        </h1>
        <p className="mt-2 max-w-3xl text-grey-600">
          Every outside service the platform uses. Market price keys are stored encrypted in Supabase Vault and can only be
          written here; the others live in Edge Function secrets or Vercel environment variables. Only the last 4 characters
          of a key are ever shown.
        </p>
      </header>

      {/* Master switch */}
      <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-base font-bold text-grey-900">
              <Scale className="size-4 text-brand-600" />
              Market prices (UAE vs EU)
              <StatusPill status={enabled ? { label: "On", tone: "ok" } : { label: "Off", tone: "off" }} />
            </h2>
            <p className="mt-2 text-sm text-grey-600">
              When on, each publish or relist looks the car up once: Vincario for the EU market price and the Dubizzle actor on
              Apify for the UAE price. A result under 7 days old is reused, and buyer pages never trigger a lookup.
              Estimated cost per car: about <strong>€1.99</strong> (Vincario, 100-lookup pack; from €0.90 at volume, nothing
              when it has too little data) plus about <strong>$0.05</strong> (Apify, at most 50 results, capped at $0.10),
              so roughly <strong>€2.04</strong> a car.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <Requirement ok={key("market_vincario_api_key").is_set} label="Vincario API key" />
              <Requirement ok={key("market_vincario_secret_key").is_set} label="Vincario secret key" />
              <Requirement ok={apifyKeySet} label="Apify API token" />
            </ul>
          </div>
          <MarketPricesSwitch enabled={enabled} keysReady={keysReady} />
        </div>
        <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-grey-200 bg-grey-50 px-4 py-3 text-xs text-grey-600">
          <FileText className="size-3.5 shrink-0 text-grey-500" />
          Moving every service to the business owner&apos;s accounts on launch day:
          <a href={KEY_SWAP_PROMPT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            docs/integrations/KEY_SWAP_PROMPT.md <ExternalLink className="size-3" />
          </a>
        </p>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ServiceCard
          icon={Scale}
          title="Vincario — EU market prices"
          status={vStatus}
          usage={`${vUse.lookups} lookup${vUse.lookups === 1 ? "" : "s"} in ${monthName}${vUse.failed ? ` (${vUse.failed} failed)` : ""} · est. ${eur(vUse.cost)}`}
          steps={[
            <>Sign in at <Ext href="https://vincario.com/">vincario.com</Ext> with the business owner&apos;s account.</>,
            <>Open the menu under the profile name and choose <strong>API</strong>. Copy the <strong>API key</strong> and the <strong>Secret key</strong> (if none exist yet, the form there requests them).</>,
            <>Vehicle Market Value lookups are prepaid packs (€1.99 a lookup for 100). Buying credit is the owner&apos;s decision.</>,
            <>Paste both keys below. The VIN-decoding keys further down are separate and stay where they are.</>,
          ]}
        >
          <IntegrationKeyField name="market_vincario_api_key" label="API key" {...keyProps(key("market_vincario_api_key"))} />
          <IntegrationKeyField name="market_vincario_secret_key" label="Secret key" {...keyProps(key("market_vincario_secret_key"))} />
        </ServiceCard>

        <ServiceCard
          icon={Store}
          title="Apify — UAE market prices (Dubizzle Motors)"
          status={aStatus}
          usage={`${aUse.lookups} run${aUse.lookups === 1 ? "" : "s"} in ${monthName}${aUse.failed ? ` (${aUse.failed} failed)` : ""} · est. ${usd(aUse.cost)}`}
          steps={[
            <>Sign in at <Ext href="https://console.apify.com/">console.apify.com</Ext> with the business owner&apos;s account (the free plan includes $5 of usage a month).</>,
            <>Go to <Ext href="https://console.apify.com/settings/integrations">Settings → API &amp; Integrations</Ext>, and under <strong>Personal API tokens</strong> create a token named “XportACar market prices”.</>,
            <>Paste it below. The actor is pay per result; no rental or subscription is needed.</>,
          ]}
        >
          <IntegrationKeyField name="market_apify_token" label="API token" {...keyProps(key("market_apify_token"))} />
          <ApifyActorField actor={actor} />
        </ServiceCard>

        <ServiceCard
          icon={Mail}
          title="Resend — email (read-only here)"
          status={configured(!!resendKey)}
          last4={last4Of(resendKey)}
          where="Vercel environment variable RESEND_API_KEY (Production)"
          usage={`${emailsRes.count ?? 0} automated emails logged in ${monthName} (account and order emails are not counted here; Resend's dashboard has the full count). Plan-based pricing.`}
          steps={[
            <>Sign in at <Ext href="https://resend.com/api-keys">resend.com/api-keys</Ext> and create a key with sending access.</>,
            <>The sending domain (xportacar.com) must be verified in that same Resend account, which takes DNS records.</>,
            <>Set it as RESEND_API_KEY in Vercel (Production) and redeploy.</>,
          ]}
        />

        <ServiceCard
          icon={ScanLine}
          title="Auto.dev — VIN decoding (read-only here)"
          status={autodev ? configured(autodev.set) : { label: "Unknown", tone: "info", detail: "The status check did not answer." }}
          last4={autodev?.last4 ?? null}
          where="Edge Function secret AUTODEV_API_KEY (vin-decoder-proxy, valuation-proxy)"
          usage="Lookups are not logged. Plan-based pricing (auto.dev Starter)."
          steps={[
            <>Sign in at <Ext href="https://auto.dev/">auto.dev</Ext> and copy the API key from the dashboard.</>,
            <>Set it with <code className="rounded bg-grey-100 px-1">supabase secrets set AUTODEV_API_KEY=…</code> (prompted, never typed into a log).</>,
          ]}
        />

        <ServiceCard
          icon={KeyRound}
          title="Vincario — VIN decoding (read-only here)"
          status={vinApi && vinSecret ? configured(vinApi.set && vinSecret.set) : { label: "Unknown", tone: "info", detail: "The status check did not answer." }}
          last4={vinApi?.last4 ?? null}
          last4Extra={vinSecret?.last4 ? `secret ••••${vinSecret.last4}` : null}
          where="Edge Function secrets VINCARIO_API_KEY and VINCARIO_SECRET_KEY (vin-decoder-proxy)"
          usage={`${decodes} paid decode${decodes === 1 ? "" : "s"} in ${monthName} · est. ${eur(decodes * VINCARIO_DECODE_EUR)} (runs only when the free decoders miss a field; cached 90 days).`}
          steps={[
            <>Same Vincario account and API page as the market prices keys above.</>,
            <>Set them with <code className="rounded bg-grey-100 px-1">supabase secrets set VINCARIO_API_KEY=… VINCARIO_SECRET_KEY=…</code>.</>,
          ]}
        />

        <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-grey-900">
            <FlaskConical className="size-4 text-brand-600" />
            Test lookup
          </h2>
          <p className="mb-4 text-xs text-grey-500">
            One live, paid lookup for the chosen car, to confirm a key works. The result is saved to that car&apos;s market
            prices and logged below. Estimated: Vincario {eur(VINCARIO_MARKET_VALUE_EUR)}, Apify about $0.05.
          </p>
          <TestLookupPanel enabled={enabled} vehicles={vehicles} />
        </section>
      </div>

      {/* Recent lookups */}
      <section className="mt-6 rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-grey-900">Recent market price lookups</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-grey-500">No lookups yet. Market prices have not run.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-grey-500">
                <tr className="[&>th]:py-2 [&>th]:pr-4"><th>When</th><th>Service</th><th>Trigger</th><th>Result</th><th>Records</th><th>Est. cost</th><th>Vehicle</th></tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {recent.map((r, i) => (
                  <tr key={i} className="[&>td]:py-2 [&>td]:pr-4">
                    <td className="whitespace-nowrap text-grey-600">{when(r.created_at)}</td>
                    <td className="font-medium text-grey-900">{r.service}</td>
                    <td className="text-grey-600">{r.triggered_by}</td>
                    <td className={r.success ? "text-success-700" : "font-mono text-xs text-error-700"}>{r.success ? "ok" : r.error ?? "error"}</td>
                    <td className="tabular-nums text-grey-700">{r.records ?? "—"}</td>
                    <td className="tabular-nums text-grey-700">{r.cost_currency === "USD" ? usd(Number(r.est_cost)) : eur(Number(r.est_cost))}</td>
                    <td>{r.vehicle_id ? <Link href={`/admin/vehicles/${r.vehicle_id}`} className="text-xs font-medium text-brand-700 hover:underline">open</Link> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ------- helpers ----------------------------------------------------

function keyProps(k: KeyRow) {
  return { isSet: k.is_set, last4: k.last4, updatedAt: k.updated_at };
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
      {children}
    </a>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="size-4 text-success-600" /> : <CircleOff className="size-4 text-grey-400" />}
      <span className={ok ? "text-grey-900" : "text-grey-500"}>{label}{ok ? "" : " (missing)"}</span>
    </li>
  );
}

const TONE: Record<Tone, string> = {
  ok: "bg-success-50 text-success-700 ring-success-100",
  off: "bg-grey-100 text-grey-700 ring-grey-200",
  warn: "bg-warning-50 text-warning-700 ring-warning-100",
  error: "bg-error-50 text-error-700 ring-error-100",
  info: "bg-brand-50 text-brand-700 ring-brand-100",
};

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${TONE[status.tone]}`}>
      {status.tone === "error" && <AlertCircle className="size-3" />}
      {status.label}
    </span>
  );
}

function ServiceCard({
  icon: Icon, title, status, last4, last4Extra, where, usage, steps, children,
}: {
  icon: typeof Plug;
  title: string;
  status: Status;
  last4?: string | null;
  last4Extra?: string | null;
  where?: string;
  usage: string;
  steps: React.ReactNode[];
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-grey-900">
          <Icon className="size-4 text-brand-600" />
          {title}
        </h2>
        <StatusPill status={status} />
      </div>
      {status.detail && <p className={`mt-1 text-xs ${status.tone === "error" ? "font-mono text-error-700" : "text-grey-500"}`}>{status.detail}</p>}
      {(where || last4 !== undefined) && (
        <dl className="mt-4 space-y-1.5 text-sm">
          {where && <div className="flex flex-wrap justify-between gap-2"><dt className="text-grey-500">Stored in</dt><dd className="text-right text-grey-800">{where}</dd></div>}
          {last4 !== undefined && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-grey-500">Key</dt>
              <dd className="font-mono text-grey-900">{last4 ? `••••${last4}` : "—"}{last4Extra ? ` · ${last4Extra}` : ""}</dd>
            </div>
          )}
        </dl>
      )}
      {children && <div className="mt-4 space-y-4">{children}</div>}
      <p className="mt-4 text-xs text-grey-600"><span className="font-semibold text-grey-800">This month:</span> {usage}</p>
      <details className="mt-3 rounded-lg border border-grey-200 bg-grey-50 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-grey-700">Where to get this key</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-grey-700">
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </details>
    </section>
  );
}
