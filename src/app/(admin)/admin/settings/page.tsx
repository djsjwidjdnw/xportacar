import {
  Settings as SettingsIcon, Building2, Mail, CreditCard, HardDrive,
  CheckCircle2, AlertCircle, Database,
} from "lucide-react";

import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { isStripeConfigured } from "@/lib/stripe";
import { loadPlatformSettings } from "@/lib/platform-settings";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  // Storage usage — sum the file_size column on storage.objects if our
  // service-role client can read it. Falls back to "—" if not.
  const stripeOk = isStripeConfigured();
  const emailOk  = !!process.env.RESEND_API_KEY;

  // Live, editable platform config loaded from the storage-backed JSON.
  const settings = await loadPlatformSettings();

  // Counts for the storage panel (counts only — bytes require the storage
  // admin API which isn't accessible through createClient).
  const { count: vehiclePhotos } = await supabase
    .from("vehicle_photos")
    .select("*", { count: "exact", head: true });
  const { count: kycDocs } = await supabase
    .from("kyc_submissions")
    .select("*", { count: "exact", head: true });

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs className="mb-5" items={[{ label: "Settings" }]} />
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-grey-900">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <SettingsIcon className="size-5" />
          </span>
          Settings
        </h1>
        <p className="mt-2 text-grey-600">
          Read-only overview of the platform&apos;s effective configuration.
        </p>
      </header>

      {/* Editable platform config — saves to Supabase Storage (JSON blob) */}
      <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-grey-900">
          <Building2 className="size-4 text-brand-600" />
          Platform configuration
        </h2>
        <p className="mb-6 text-xs text-grey-500">
          These values are persisted under <code className="rounded bg-grey-100 px-1 py-0.5 text-[11px]">_internal/platform-settings.json</code> in Supabase Storage. Reads happen on every server render so changes take effect immediately.
        </p>
        <PlatformSettingsForm initial={settings} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Read-only flags from the same config blob */}
        <Section title="Auction features" icon={Building2}>
          <Setting label="Reserve price"  value={settings.reserveEnforced     ? "Enforced" : "Disabled"} status={settings.reserveEnforced ? "ok" : "warn"} />
          <Setting label="Proxy bidding"  value={settings.proxyBiddingEnabled ? "Enabled"  : "Disabled"} status={settings.proxyBiddingEnabled ? "ok" : "warn"} />
          <Setting label="Buy-now"        value={settings.buyNowEnabled       ? "Enabled"  : "Disabled"} status={settings.buyNowEnabled ? "ok" : "warn"} />
          <Setting label="Min bid increment" value={`€${settings.minBidIncrementEur}+`}
                   hint="Tiered: €100 / €250 / €500 / €1k / €2.5k by current bid band" />
        </Section>

        {/* Email */}
        <Section title="Email" icon={Mail}>
          <Setting
            label="Transactional mail"
            value={emailOk ? "Resend connected" : "Not configured"}
            status={emailOk ? "ok" : "warn"}
            hint={emailOk ? "RESEND_API_KEY is set." : "Set RESEND_API_KEY to enable bid/win/outbid notifications."}
          />
          <Setting label="From address" value={process.env.EMAIL_FROM ?? "hello@xportacar.com"} />
          <Setting label="Templates"    value="outbid · auction-won · welcome" />
        </Section>

        {/* Payments */}
        <Section title="Payments" icon={CreditCard}>
          <Setting
            label="Stripe Checkout"
            value={stripeOk ? "Connected" : "Not configured"}
            status={stripeOk ? "ok" : "warn"}
            hint={stripeOk
              ? "STRIPE_SECRET_KEY is set — Pay Now buttons are active."
              : "Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to enable card payments. Wire-transfer flow stays available."}
          />
          <Setting label="Currency"        value="EUR (primary)" hint="USD/AED/GBP shown via client-side conversion." />
          <Setting label="Wire transfer"   value="Bradshaw Automation" hint="Bank details mailed to winners after auction close." />
        </Section>

        {/* Storage */}
        <Section title="Storage" icon={HardDrive}>
          <Setting label="Backend"           value="Supabase Storage" />
          <Setting label="Bucket — vehicles" value={`${formatNumber(vehiclePhotos ?? 0)} photos`} />
          <Setting label="Bucket — kyc"      value={`${formatNumber(kycDocs ?? 0)} documents`} />
          <Setting label="Database"          value="Supabase Postgres" status="ok" hint="Connection pool warm via PostgREST." />
        </Section>
      </div>

      {/* Footnote */}
      <p className="mt-8 flex items-center gap-2 rounded-xl border border-grey-200 bg-grey-50 px-4 py-3 text-xs text-grey-600">
        <Database className="size-3.5 shrink-0" />
        Saved to <code className="rounded bg-white px-1 py-0.5 text-[11px]">vehicle-photos/_internal/platform-settings.json</code> in Supabase Storage. Falls back to baked-in defaults if the file is missing.
      </p>
    </div>
  );
}

// ------- helpers ----------------------------------------------------

function Section({
  title, icon: Icon, children,
}: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-grey-900">
        <Icon className="size-4 text-brand-600" />
        {title}
      </h2>
      <dl className="space-y-3">{children}</dl>
    </section>
  );
}

function Setting({
  label, value, hint, status,
}: {
  label: string;
  value: string;
  hint?: string;
  status?: "ok" | "warn";
}) {
  return (
    <div className="border-b border-grey-100 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-sm text-grey-600">{label}</dt>
        <dd className="flex items-center gap-1.5">
          {status === "ok"   && <CheckCircle2 className="size-3.5 text-success-600" />}
          {status === "warn" && <AlertCircle className="size-3.5 text-warning-600" />}
          <span className="text-sm font-semibold text-grey-900">{value}</span>
        </dd>
      </div>
      {hint && <p className="mt-1 text-[11px] text-grey-500">{hint}</p>}
    </div>
  );
}
