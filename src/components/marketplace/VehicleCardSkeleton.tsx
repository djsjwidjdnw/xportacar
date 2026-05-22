import { Skeleton } from "@/components/ui/skeleton";

// Placeholder card matching the live VehicleCard footprint — used in
// loading.tsx files so we can stream a believable list while the
// vehicles fetch.
export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-grey-200 bg-white shadow-xs">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <Skeleton className="h-5 flex-1 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-1/2 rounded" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="border-t border-grey-100 pt-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="mt-1.5 h-6 w-32 rounded" />
        </div>
      </div>
    </div>
  );
}

export function VehicleCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <VehicleCardSkeleton key={i} />
      ))}
    </div>
  );
}
