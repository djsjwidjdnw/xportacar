import { Skeleton } from "@/components/ui/skeleton";
import { VehicleCardSkeletonGrid } from "@/components/marketplace/VehicleCardSkeleton";

export default function MarketplaceLoading() {
  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero / heading area */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Filters area */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 flex-1 min-w-[200px] rounded-full" />
        </div>

        {/* Grid */}
        <VehicleCardSkeletonGrid count={9} />
      </div>
    </div>
  );
}
