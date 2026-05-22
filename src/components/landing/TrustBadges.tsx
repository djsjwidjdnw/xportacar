// Trust band — sits between the hero and feature grid to anchor the
// "we work with real European trade buyers" message. No live data; the
// numbers are baked into the design as static legitimacy markers.

import { ShieldCheck, BadgeCheck, Building2, Ship, Award, Lock } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "200-point inspection" },
  { icon: BadgeCheck,  label: "Verified UAE sellers" },
  { icon: Building2,   label: "Trusted by EU dealers" },
  { icon: Ship,        label: "RoRo to 4 major EU ports" },
  { icon: Award,       label: "German TÜV partners" },
  { icon: Lock,        label: "Escrow-backed payment" },
] as const;

export function TrustBadges() {
  return (
    <section className="border-y border-grey-100 bg-grey-50/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-grey-500">
          Built for European trade buyers
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {BADGES.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-2.5 rounded-xl border border-grey-200 bg-white px-3.5 py-3 shadow-xs transition-shadow hover:shadow-md"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <b.icon className="size-4" />
              </span>
              <span className="text-xs font-semibold text-grey-700">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
