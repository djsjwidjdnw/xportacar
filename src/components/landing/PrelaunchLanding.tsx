"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Gavel, Truck, ArrowRight, CheckCircle2 } from "lucide-react";

import { useTranslations } from "@/i18n/provider";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type FormState = "idle" | "loading" | "success" | "error";

export function PrelaunchLanding({ countdownTarget }: { countdownTarget: string | null }) {
  const t = useTranslations("prelaunch");

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div className="absolute inset-0 -z-10 bg-grid-faint [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_70%)]" />
      <div className="absolute -top-32 left-1/2 -z-10 size-[55rem] max-w-[100vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-300/30 via-brand-200/20 to-transparent blur-3xl" />

      {/* Faded logo watermark — subordinate to the signup, kept subtle. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/xportacar-logo.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 w-[72vw] max-w-[800px] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.08]"
      />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-3xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16">
        {/* Brand wordmark — small, subordinate */}
        <p className="text-base font-bold tracking-tight text-grey-700">
          Xport<span className="text-brand-600">A</span>Car
        </p>

        {/* Hero — compact, sits above the signup */}
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold leading-[1.1] tracking-tight text-grey-900 sm:text-4xl">
          {t("headline")}
        </h1>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-grey-600">
          {t("subheadline")}
        </p>

        {/* SIGNUP — the centerpiece */}
        <div className="mt-8 w-full max-w-xl rounded-3xl border border-grey-200 bg-white/85 p-6 shadow-2xl shadow-brand-500/10 ring-1 ring-brand-500/5 backdrop-blur sm:mt-10 sm:p-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-grey-900 sm:text-3xl">
            {t("signupHeadline")}
          </h2>
          <SignupForm />
        </div>

        {countdownTarget && (
          <Countdown
            target={countdownTarget}
            label={t("countdownLabel")}
            units={{ d: t("unitDay"), h: t("unitHour"), m: t("unitMin"), s: t("unitSec") }}
          />
        )}

        {/* Supporting value props — smaller, below the signup */}
        <div className="mt-14 grid w-full gap-3 sm:grid-cols-3">
          <ValueProp icon={<Gavel className="size-5" />} title={t("vp1Title")} body={t("vp1Body")} />
          <ValueProp icon={<ShieldCheck className="size-5" />} title={t("vp2Title")} body={t("vp2Body")} />
          <ValueProp icon={<Truck className="size-5" />} title={t("vp3Title")} body={t("vp3Body")} />
        </div>

        <footer className="mt-16 w-full border-t border-grey-200 pt-6 text-sm text-grey-500">
          <p>
            <a href="mailto:contact@xportacar.com" className="font-medium text-grey-700 hover:text-brand-600">contact@xportacar.com</a>
          </p>
          <p className="mt-2">{t("footerAbout")}</p>
          <p className="mt-2 text-xs text-grey-400">© XportACar — {t("footerRights")}</p>
        </footer>
      </div>
    </div>
  );
}

function ValueProp({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-grey-200 bg-white/60 p-4 text-left shadow-sm backdrop-blur">
      <div className="mb-2.5 grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>
      <h3 className="text-sm font-bold text-grey-900">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-grey-600">{body}</p>
    </div>
  );
}

function Countdown({
  target, label, units,
}: {
  target: string;
  label: string;
  units: { d: string; h: string; m: string; s: string };
}) {
  // null until mounted to avoid an SSR/client hydration mismatch on the numbers.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const targetMs = new Date(target).getTime();
  if (Number.isNaN(targetMs)) return null;
  const remaining = now == null ? null : Math.max(0, targetMs - now);

  const parts = (() => {
    if (remaining == null) return null;
    const s = Math.floor(remaining / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
    };
  })();

  const cell = (value: number | null, unit: string) => (
    <div className="flex min-w-[64px] flex-col items-center rounded-xl border border-grey-200 bg-white px-3 py-2.5 shadow-sm">
      <span className="text-2xl font-extrabold tabular-nums text-grey-900 sm:text-3xl">
        {value == null ? "—" : String(value).padStart(2, "0")}
      </span>
      <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-grey-500">{unit}</span>
    </div>
  );

  return (
    <div className="mt-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-grey-500">{label}</p>
      <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
        {cell(parts?.d ?? null, units.d)}
        {cell(parts?.h ?? null, units.h)}
        {cell(parts?.m ?? null, units.m)}
        {cell(parts?.s ?? null, units.s)}
      </div>
    </div>
  );
}

function SignupForm() {
  const t = useTranslations("prelaunch");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = email.trim();
    if (!EMAIL_RE.test(clean)) {
      setErr(t("invalidEmail"));
      setState("error");
      return;
    }
    setState("loading");
    setErr(null);
    try {
      const r = await fetch("/api/prelaunch/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) {
        setState("success");
      } else {
        setErr(j.error ?? t("errorGeneric"));
        setState("error");
      }
    } catch {
      setErr(t("errorGeneric"));
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="mt-5 flex w-full flex-col items-center rounded-2xl border border-success-200 bg-success-50 px-6 py-8">
        <CheckCircle2 className="size-9 text-success-600" />
        <p className="mt-3 text-lg font-bold text-grey-900">{t("successTitle")}</p>
        <p className="mt-1 text-sm text-grey-600">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="h-20 w-full flex-1 rounded-xl border-2 border-grey-200 bg-white px-4 text-lg text-grey-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 sm:h-14 sm:text-base"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="inline-flex h-14 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-7 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-700 hover:shadow-xl disabled:opacity-60"
        >
          {state === "loading" ? t("submitting") : t("notifyCta")}
          {state !== "loading" && <ArrowRight className="size-5" />}
        </button>
      </div>
      {state === "error" && err && (
        <p className="mt-2 text-sm text-error-600">{err}</p>
      )}
      <p className="mt-3 text-xs text-grey-400">{t("privacyNote")}</p>
    </form>
  );
}
