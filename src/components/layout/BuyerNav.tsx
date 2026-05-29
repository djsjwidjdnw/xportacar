"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gavel, Heart, LayoutDashboard, Menu, ShoppingBag, TrendingUp, X } from "lucide-react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

import { Logo } from "@/components/shared/Logo";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/layout/UserMenu";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { Notification, Profile } from "@/types";

interface NavLink {
  href: string;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  authOnly?: boolean;
}

// Public links (shown to everyone) + authed-only "My Bids" / "Dashboard" /
// "Watchlist".  Profile lives in the avatar dropdown, NOT here.
// "My Bids" anchors to the bids section of the dashboard; "Dashboard" lands
// at the top with the stat cards.  Same page, two entry points — matches
// what the buyer's testing feedback asked for.
const LINKS: NavLink[] = [
  { href: "/marketplace",     key: "marketplace", icon: ShoppingBag },
  { href: "/auctions",        key: "auctions",    icon: Gavel },
  { href: "/dashboard#bids",  key: "myBids",      icon: TrendingUp,     authOnly: true },
  { href: "/dashboard",       key: "dashboard",   icon: LayoutDashboard, authOnly: true },
  { href: "/watchlist",       key: "watchlist",   icon: Heart,          authOnly: true },
];

export function BuyerNav({
  profile,
  notifications = [],
}: {
  profile: Profile | null;
  notifications?: Notification[];
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visibleLinks = LINKS.filter((l) => !l.authOnly || !!profile);

  return (
    <header className="sticky top-0 z-40 border-b border-grey-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-0.5 md:flex">
            {visibleLinks.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-grey-600 hover:bg-grey-50 hover:text-grey-900",
                  )}
                >
                  {t(l.key)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {profile && (
            <NotificationBell userId={profile.id} initialNotifications={notifications} />
          )}
          <LanguageSwitcher />
          {profile ? (
            <UserMenu profile={profile} variant="buyer" />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                {t("signIn")}
              </Link>
              <Link href="/register" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
                {t("register")}
              </Link>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={
              <Button variant="ghost" size="icon" className="size-10 shrink-0 md:hidden" aria-label="Menu">
                {open ? <X className="size-6" /> : <Menu className="size-6" />}
              </Button>
            } />
            <SheetContent side="right" className="w-[280px] p-0">
              <SheetHeader className="border-b border-grey-200 px-5 py-4">
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3">
                {visibleLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                        isActive(pathname, l.href)
                          ? "bg-brand-50 text-brand-700"
                          : "text-grey-700 hover:bg-grey-50",
                      )}
                    >
                      <Icon className="size-4 text-grey-500" />
                      {t(l.key)}
                    </Link>
                  );
                })}
                {profile && (
                  <>
                    <div className="mt-1 border-t border-grey-200 pt-1" />
                    <Link
                      href="/profile"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-grey-700 hover:bg-grey-50"
                    >
                      {t("profile")}
                    </Link>
                    <Link
                      href="/api/auth/sign-out"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50"
                    >
                      {t("signOut")}
                    </Link>
                  </>
                )}
                {!profile && (
                  <div className="mt-2 flex flex-col gap-2 border-t border-grey-200 pt-3">
                    <Link href="/login" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: "outline", size: "default" }))}>
                      {t("signIn")}
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: "default", size: "default" }))}>
                      {t("register")}
                    </Link>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string): boolean {
  // Strip hash/query for the active comparison so /dashboard#bids and
  // /dashboard both highlight when pathname is /dashboard.
  const cleanHref = href.split(/[?#]/)[0];
  if (cleanHref === "/marketplace") return pathname === "/marketplace" || pathname.startsWith("/vehicle/");
  if (cleanHref === "/dashboard")   return pathname === "/dashboard" && href === "/dashboard";
  if (href === "/dashboard#bids")   return false; // never sticky-highlight the anchor entry
  return pathname === cleanHref || pathname.startsWith(cleanHref + "/");
}
