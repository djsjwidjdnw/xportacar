"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

import { Logo } from "@/components/shared/Logo";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useTranslations } from "@/i18n/provider";
import { cn, initials } from "@/lib/utils";
import type { Notification, Profile } from "@/types";

interface NavLink { href: string; key: string }

const LINKS: NavLink[] = [
  { href: "/marketplace", key: "marketplace" },
  { href: "/auctions",    key: "auctions" },
  { href: "/dashboard",   key: "myBids" },
  { href: "/watchlist",   key: "watchlist" },
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

  return (
    <header className="sticky top-0 z-40 border-b border-grey-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const active =
                pathname === l.href || pathname.startsWith(l.href + "/");
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
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="size-7">
                    <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
                    <AvatarFallback className="bg-brand-100 text-xs font-semibold text-brand-700">
                      {initials(profile.full_name ?? profile.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium text-grey-700 sm:inline">
                    {profile.full_name ?? profile.email}
                  </span>
                </Button>
              } />
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-grey-900">
                      {profile.full_name ?? profile.email}
                    </span>
                    {profile.company_name && (
                      <span className="text-xs text-grey-500">{profile.company_name}</span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/dashboard" />}>{t("dashboard")}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/profile" />}>{t("profile")}</DropdownMenuItem>
                {(profile.role === "admin" || profile.role === "superadmin") && (
                  <DropdownMenuItem render={<Link href="/admin/dashboard" />}>Admin</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/api/auth/sign-out" />} className="text-error-600">
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            } />
            <SheetContent side="right" className="w-[280px] p-0">
              <SheetHeader className="border-b border-grey-200 px-5 py-4">
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium",
                      pathname.startsWith(l.href)
                        ? "bg-brand-50 text-brand-700"
                        : "text-grey-700 hover:bg-grey-50",
                    )}
                  >
                    {t(l.key)}
                  </Link>
                ))}
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
