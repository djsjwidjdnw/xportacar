import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  variant = "light",
  href = "/",
}: {
  className?: string;
  variant?: "light" | "dark";
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-extrabold tracking-tight",
        variant === "dark" ? "text-white" : "text-grey-900",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 13l2-5h14l2 5M5 13v5h2m12-5v5h-2M5 18h14M8 13h8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="text-lg">
        Xport<span className="text-brand-600">A</span>Car
      </span>
    </Link>
  );
}
