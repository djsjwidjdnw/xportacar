import { cn } from "@/lib/utils"

// A shimmering placeholder block. Uses a left-to-right gradient sweep on
// top of a neutral grey base so it reads as "content loading" rather than
// just "empty box". `animate-pulse` alone isn't expressive enough — the
// gradient sweep makes it feel like an active loading state.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-grey-100",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
