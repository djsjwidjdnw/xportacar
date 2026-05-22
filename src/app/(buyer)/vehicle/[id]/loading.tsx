import { Skeleton } from "@/components/ui/skeleton";

export default function VehicleLoading() {
  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="mb-6 h-4 w-64" />

        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
              <Skeleton className="mb-4 h-5 w-40" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="space-y-3 rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <div className="space-y-2 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
