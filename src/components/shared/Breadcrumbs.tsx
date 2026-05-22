// Reusable breadcrumb trail. Pass the segments in order — the last one
// renders as plain text (the current page); preceding ones are links.

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  href?: string;
  label: string;
}

export function Breadcrumbs({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5 text-grey-500">
        <li>
          <Link
            href="/"
            className="inline-flex items-center gap-1 transition-colors hover:text-brand-700"
            aria-label="Home"
          >
            <Home className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
        </li>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5 text-grey-400" aria-hidden />
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="font-medium transition-colors hover:text-brand-700"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "font-semibold text-grey-900" : "text-grey-500"}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
