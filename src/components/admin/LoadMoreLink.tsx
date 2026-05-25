import Link from "next/link";

// Server-rendered "Load more" for admin tables. Grows the `?show` count by
// one page; the page re-renders SSR with more rows. Renders nothing once the
// full set is shown. Keeps the initial load capped at one page so admin pages
// never pull 100k rows into the browser.
export function LoadMoreLink({
  basePath,
  params = {},
  shown,
  total,
  pageSize = 20,
}: {
  basePath: string;
  params?: Record<string, string | undefined>;
  shown: number;
  total: number;
  pageSize?: number;
}) {
  if (shown >= total) return null;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  qs.set("show", String(shown + pageSize));
  return (
    <div className="mt-6 flex items-center justify-center">
      <Link
        href={`${basePath}?${qs.toString()}`}
        scroll={false}
        prefetch={false}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-grey-300 bg-white px-5 text-sm font-bold text-grey-800 shadow-xs transition-colors hover:border-grey-400 hover:bg-grey-50"
      >
        Load more
        <span className="font-medium text-grey-400">({shown} / {total})</span>
      </Link>
    </div>
  );
}
