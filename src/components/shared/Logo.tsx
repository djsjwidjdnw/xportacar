import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Car-free brand (2026-10-07): the "XPortAcar" wordmark regenerated from the
// original raster logo (exact type + colour). The light variant swaps the
// navy letters to white for dark backgrounds; the blue "A" is kept.
const WORDMARK = {
  light: "/logos/xportacar-wordmark.png",
  dark: "/logos/xportacar-wordmark-light.png",
} as const;
const WORDMARK_RATIO = 1067 / 143; // intrinsic size of both wordmark files

export function Logo({
  className,
  variant = "light",
  href = "/",
  withWordmark = true,
  size = 36,
}: {
  className?: string;
  /** "dark" = for dark backgrounds (admin sidebar). */
  variant?: "light" | "dark";
  href?: string;
  /** Show the wordmark; false shows the square "X" mark only. */
  withWordmark?: boolean;
  /** Pixel height of the logo row. */
  size?: number;
}) {
  const h = Math.round(size * 0.78);
  return (
    <Link href={href} aria-label="XportACar" className={cn("inline-flex items-center", className)}>
      {withWordmark ? (
        <Image
          src={WORDMARK[variant]}
          alt="XportACar"
          width={Math.round(h * WORDMARK_RATIO)}
          height={h}
          priority
          className="w-auto object-contain"
          style={{ height: h }}
        />
      ) : (
        <Image
          src="/icons/icon-192.png"
          alt="XportACar"
          width={size}
          height={size}
          priority
          className="rounded-md"
          style={{ height: size, width: size }}
        />
      )}
    </Link>
  );
}
