"use client";

// Notification bell with unread-count badge.  Hydrated with server-fetched
// rows; subscribes to Supabase Realtime so new notifications bump the badge
// without a page refresh.

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, Check, ShoppingCart, TrendingDown, Trophy, Wallet, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(buyer)/notifications/actions";
import type { Notification, NotificationType } from "@/types";

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  outbid:          TrendingDown,
  auction_won:     Trophy,
  auction_ending:  Clock,
  new_vehicle:     ShoppingCart,
  payment_due:     Wallet,
  status_update:   Bell,
};

const TINT: Record<NotificationType, string> = {
  outbid:          "bg-warning-50 text-warning-700",
  auction_won:     "bg-success-50 text-success-700",
  auction_ending:  "bg-brand-50 text-brand-700",
  new_vehicle:     "bg-brand-50 text-brand-700",
  payment_due:     "bg-error-50 text-error-700",
  status_update:   "bg-grey-100 text-grey-700",
};

export function NotificationBell({
  userId,
  initialNotifications,
}: {
  userId: string;
  initialNotifications: Notification[];
}) {
  const [rows, setRows] = useState<Notification[]>(initialNotifications);
  const [, startTransition] = useTransition();

  const unread = useMemo(() => rows.filter((n) => !n.read).length, [rows]);

  // Subscribe to new notifications.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Notification;
          setRows((prev) =>
            prev.some((n) => n.id === next.id) ? prev : [next, ...prev].slice(0, 20),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Notification;
          setRows((prev) => prev.map((n) => (n.id === next.id ? next : n)));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markOne = (id: string) => {
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    startTransition(() => {
      void markNotificationReadAction(id);
    });
  };

  const markAll = () => {
    setRows((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(() => {
      void markAllNotificationsReadAction();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
          className="relative"
        >
          <Bell className="size-5 text-grey-600" />
          {unread > 0 && (
            <span
              className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-error-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-grey-100 px-4 py-3">
          <p className="text-sm font-bold text-grey-900">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              <Check className="size-3" /> Mark all read
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-grey-500">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-grey-100 overflow-y-auto">
            {rows.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const dest = notificationLink(n);
              return (
                <li key={n.id} className={cn(
                  "flex items-start gap-3 px-4 py-3 hover:bg-grey-50",
                  !n.read && "bg-brand-50/30",
                )}>
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-current/10", TINT[n.type])}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {dest ? (
                      <Link
                        href={dest}
                        onClick={() => !n.read && markOne(n.id)}
                        className="block"
                      >
                        <p className={cn("truncate text-sm", n.read ? "font-medium text-grey-800" : "font-bold text-grey-900")}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-grey-600">{n.body}</p>
                      </Link>
                    ) : (
                      <>
                        <p className={cn("truncate text-sm", n.read ? "font-medium text-grey-800" : "font-bold text-grey-900")}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-grey-600">{n.body}</p>
                      </>
                    )}
                    <p className="mt-1 text-[11px] text-grey-500">{formatRelativeTime(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      onClick={() => markOne(n.id)}
                      className="grid size-6 shrink-0 place-items-center rounded-md text-grey-400 hover:bg-white hover:text-brand-700"
                    >
                      <Check className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-grey-100 px-4 py-2 text-right">
          <Link href="/dashboard" className="text-xs font-semibold text-brand-700 hover:underline">
            View all activity →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function notificationLink(n: Notification): string | null {
  const data = (n.data ?? {}) as { auction_id?: string; vehicle_id?: string };
  if (data.auction_id) return `/auction/${data.auction_id}`;
  if (data.vehicle_id) return `/vehicle/${data.vehicle_id}`;
  return null;
}
