"use client";

// Mobile-only "get the app" promo. Shows a sleek blue banner pinned to the
// bottom of the screen on phones (viewport < 768px or a mobile user-agent).
// Dismissal is remembered in localStorage so it never nags again. Hidden on
// desktop both by the media query check and the `md:hidden` class.

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "xpc_app_banner_dismissed";
// Placeholder until the TestFlight / App Store listing is live — update here
// when the real download link is ready.
const APP_DOWNLOAD_URL = "https://xportacar.com/app";

export function AppDownloadBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* private mode */ }
    const isMobile =
      window.matchMedia("(max-width: 767px)").matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!dismissed && isMobile) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      role="dialog"
      aria-label="Get the XportACar app"
    >
      <div className="m-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-3 text-white shadow-lg ring-1 ring-brand-500/40">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
          <Image
            src="/logos/xportacar-logo.jpg"
            alt="XportACar"
            width={32}
            height={32}
            className="size-8 rounded-md object-contain"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Get the XportACar app</p>
          <p className="truncate text-xs text-white/85">for a better experience</p>
        </div>
        <a
          href={APP_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-700 shadow-sm transition-colors hover:bg-white/90"
        >
          Download App
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
