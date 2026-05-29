"use client";

// Self-contained user dropdown (no base-ui Menu). The previous avatar menu used
// base-ui's <Menu.Item> with a nested <Link> anchor, which crashed the page on
// open (composite menu item cannot host a focusable child). This implementation
// is a plain button + click-outside backdrop + absolutely-positioned panel, so
// it can never throw from a primitive's internals.
import Link from "next/link";
import { LayoutDashboard, LogOut, ShoppingBag, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "@/i18n/provider";
import { cn, initials } from "@/lib/utils";
import type { Profile } from "@/types";

export function UserMenu({
  profile,
  variant = "buyer",
}: {
  profile: Profile;
  variant?: "buyer" | "admin";
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const displayName = profile.full_name ?? profile.email ?? "Account";
  const isAdminUser = profile.role === "admin" || profile.role === "superadmin";

  const item =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-grey-700 hover:bg-grey-50 hover:text-grey-900";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-grey-100"
      >
        <Avatar className="size-7">
          <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-grey-700 sm:inline">
          {displayName}
        </span>
      </button>

      {open && (
        <>
          {/* click-outside backdrop */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-grey-200 bg-white p-1 shadow-lg"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold text-grey-900">{displayName}</p>
              {profile.company_name ? (
                <p className="truncate text-xs text-grey-500">{profile.company_name}</p>
              ) : (
                <p className="truncate text-xs text-grey-500 capitalize">{profile.role}</p>
              )}
            </div>
            <div className="my-1 h-px bg-grey-100" />

            {variant === "admin" ? (
              <Link href="/marketplace" className={item} onClick={() => setOpen(false)}>
                <ShoppingBag className="size-4 text-grey-500" />
                View site
              </Link>
            ) : (
              <Link href="/dashboard" className={item} onClick={() => setOpen(false)}>
                <LayoutDashboard className="size-4 text-grey-500" />
                {t("dashboard")}
              </Link>
            )}

            <Link href="/profile" className={item} onClick={() => setOpen(false)}>
              <UserIcon className="size-4 text-grey-500" />
              {t("profile")}
            </Link>

            {variant !== "admin" && isAdminUser && (
              <Link href="/admin/dashboard" className={item} onClick={() => setOpen(false)}>
                <LayoutDashboard className="size-4 text-grey-500" />
                Admin
              </Link>
            )}

            <div className="my-1 h-px bg-grey-100" />
            <Link
              href="/api/auth/sign-out"
              className={cn(item, "text-error-600 hover:bg-error-50 hover:text-error-700")}
              onClick={() => setOpen(false)}
            >
              <LogOut className="size-4" />
              {t("signOut")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
