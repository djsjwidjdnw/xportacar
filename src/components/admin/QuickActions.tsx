// Small "do something" launcher panel on the admin dashboard — surfaces
// the most common actions one click away. Pure links, no client logic.

import Link from "next/link";
import {
  PlusCircle, ShieldCheck, Gavel, FileText, Users, Truck, ArrowRight,
} from "lucide-react";

const ACTIONS: ReadonlyArray<{
  href: string;
  label: string;
  hint: string;
  iconName: "plus" | "shield" | "gavel" | "file" | "users" | "truck";
  accent: "brand" | "warning" | "success" | "muted";
}> = [
  { href: "/admin/vehicles?new=1", label: "Add vehicle",     hint: "Manually list a new car", iconName: "plus",   accent: "brand"   },
  { href: "/admin/kyc",            label: "Review KYC",      hint: "Pending buyer applications", iconName: "shield", accent: "warning" },
  { href: "/admin/auctions",       label: "Manage auctions", hint: "Active and scheduled lots", iconName: "gavel",  accent: "brand"   },
  { href: "/admin/invoices",       label: "Invoices",        hint: "Issue and track payments", iconName: "file",   accent: "success" },
  { href: "/admin/users",          label: "Users",           hint: "Buyers, inspectors, admins", iconName: "users",  accent: "muted"   },
  { href: "/admin/counter-offers", label: "Counter offers",  hint: "Buyer-initiated negotiations", iconName: "truck", accent: "warning" },
];

const ICONS = {
  plus:   PlusCircle,
  shield: ShieldCheck,
  gavel:  Gavel,
  file:   FileText,
  users:  Users,
  truck:  Truck,
};

const ACCENT_BG: Record<string, string> = {
  brand:   "bg-brand-50 text-brand-700 ring-brand-100",
  warning: "bg-warning-50 text-warning-700 ring-warning-100",
  success: "bg-success-50 text-success-700 ring-success-100",
  muted:   "bg-grey-100 text-grey-700 ring-grey-200",
};

export function QuickActions() {
  return (
    <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-grey-900">Quick actions</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-grey-500">
          Operations
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((a) => {
          const Icon = ICONS[a.iconName];
          return (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="group flex items-center gap-3 rounded-xl border border-grey-200 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg ring-1 ${ACCENT_BG[a.accent]}`}>
                <Icon className="size-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-grey-900">{a.label}</span>
                <span className="block text-xs text-grey-500">{a.hint}</span>
              </span>
              <ArrowRight className="size-4 text-grey-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
