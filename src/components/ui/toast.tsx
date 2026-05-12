"use client";

// Tiny in-house toast provider — no extra dependency.  Mount <Toaster /> once
// near the root of the app; call toast.ok / toast.err / toast.info from any
// client component to push a transient notification.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Kind = "ok" | "err" | "info";
interface ToastRow { id: number; kind: Kind; title: string; body?: string; ttl: number }

interface ToastContextValue {
  push: (t: Omit<ToastRow, "id" | "ttl"> & { ttl?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let externalPush: ToastContextValue["push"] | null = null;

/** Imperative helpers usable outside React (server-action callbacks etc.). */
export const toast = {
  ok:   (title: string, body?: string) => externalPush?.({ kind: "ok",   title, body }),
  err:  (title: string, body?: string) => externalPush?.({ kind: "err",  title, body }),
  info: (title: string, body?: string) => externalPush?.({ kind: "info", title, body }),
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<ToastRow[]>([]);
  let nextId = 1;

  const push = useCallback<ToastContextValue["push"]>((t) => {
    const id = nextId++ + Date.now();
    const ttl = t.ttl ?? 4500;
    setRows((r) => [...r, { id, kind: t.kind, title: t.title, body: t.body, ttl }]);
    window.setTimeout(() => {
      setRows((r) => r.filter((x) => x.id !== id));
    }, ttl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hook up the imperative helper.
  useEffect(() => {
    externalPush = push;
    return () => { if (externalPush === push) externalPush = null; };
  }, [push]);

  const dismiss = useCallback((id: number) => {
    setRows((r) => r.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100%-2rem))] flex-col gap-2">
        {rows.map((r) => (
          <ToastCard key={r.id} row={r} onDismiss={() => dismiss(r.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ row, onDismiss }: { row: ToastRow; onDismiss: () => void }) {
  const styles = {
    ok:   { bg: "bg-success-50",  border: "border-success-200", text: "text-success-700", Icon: CheckCircle2 },
    err:  { bg: "bg-error-50",    border: "border-error-200",   text: "text-error-700",   Icon: AlertTriangle },
    info: { bg: "bg-brand-50",    border: "border-brand-200",   text: "text-brand-700",   Icon: Info },
  }[row.kind];
  const Icon = styles.Icon;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg backdrop-blur",
        styles.bg, styles.border,
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", styles.text)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", styles.text)}>{row.title}</p>
        {row.body && <p className="mt-0.5 text-xs text-grey-700">{row.body}</p>}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="grid size-6 shrink-0 place-items-center rounded-md text-grey-500 hover:bg-white/60 hover:text-grey-900"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
