"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Car, Gavel, Users, BadgeDollarSign, Settings, ClipboardCheck,
  MessageSquare, FileText, ShieldCheck, HardHat,
  ChevronRight, Menu,
} from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/shared/Logo";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTranslations } from "@/i18n/provider";
import { cn, initials } from "@/lib/utils";
import type { Profile } from "@/types";

const NAV = [
  { href: "/admin/dashboard",       key: "navDashboard",   icon: LayoutDashboard },
  { href: "/admin/vehicles",        key: "navVehicles",    icon: Car },
  { href: "/admin/counter-offers",  key: "navCounterOffers", icon: MessageSquare },
  { href: "/admin/invoices",        key: "navInvoices",    icon: FileText },
  { href: "/admin/kyc",             key: "navKyc",         icon: ShieldCheck },
  { href: "/admin/auctions",        key: "navAuctions",    icon: Gavel },
  { href: "/admin/inspections",     key: "navInspections", icon: ClipboardCheck },
  { href: "/admin/inspectors",      key: "navInspectors",  icon: HardHat },
  { href: "/admin/users",           key: "navUsers",       icon: Users },
  { href: "/admin/finance",         key: "navFinance",     icon: BadgeDollarSign },
  { href: "/admin/settings",        key: "navSettings",    icon: Settings },
] as const;

function NavBody({ onNavigate, pendingKyc = 0 }: { onNavigate?: () => void; pendingKyc?: number }) {
  const pathname = usePathname();
  const t = useTranslations("admin");
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        const badge = item.href === "/admin/kyc" && pendingKyc > 0 ? pendingKyc : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-grey-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("size-4", active ? "text-brand-400" : "text-grey-400 group-hover:text-grey-200")} />
            <span className="flex-1">{t(item.key)}</span>
            {badge > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                {badge}
              </span>
            )}
            {active && <ChevronRight className="size-4 text-brand-400" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({ profile, pendingKyc = 0 }: { profile: Profile | null; pendingKyc?: number }) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 bg-grey-900 border-r border-grey-800">
      <div className="flex h-16 items-center justify-between border-b border-grey-800 px-5">
        <Logo variant="dark" href="/admin/dashboard" />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <NavBody pendingKyc={pendingKyc} />
      </div>
      <div className="border-t border-grey-800 p-4">
        {profile && (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
              <AvatarFallback className="bg-brand-700 text-xs font-semibold text-white">
                {initials(profile.full_name ?? profile.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {profile.full_name ?? profile.email}
              </p>
              <p className="truncate text-xs text-grey-400">{profile.role}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export function AdminTopBar({ profile, pendingKyc = 0 }: { profile: Profile | null; pendingKyc?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-grey-800 bg-grey-900 px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Menu">
            <Menu className="size-5" />
          </Button>
        } />
        <SheetContent side="left" className="w-[260px] border-r-0 bg-grey-900 p-0 text-white">
          <SheetHeader className="border-b border-grey-800 px-5 py-4">
            <SheetTitle className="text-left">
              <Logo variant="dark" href="/admin/dashboard" />
            </SheetTitle>
          </SheetHeader>
          <NavBody onNavigate={() => setOpen(false)} pendingKyc={pendingKyc} />
          {profile && (
            <div className="mt-auto border-t border-grey-800 p-4">
              <p className="text-sm font-semibold text-white">{profile.full_name ?? profile.email}</p>
              <p className="text-xs text-grey-400">{profile.role}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Logo variant="dark" href="/admin/dashboard" />
      <LanguageSwitcher variant="ghost" />
    </header>
  );
}
