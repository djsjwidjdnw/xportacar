import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/logos/xportacar-logo.jpg";

export function Logo({
  className,
  variant = "light",
  href = "/",
  withWordmark = true,
  size = 36,
}: {
  className?: string;
  variant?: "light" | "dark";
  href?: string;
  /** Show the "XportACar" wordmark next to the logo image. */
  withWordmark?: boolean;
  /** Pixel height of the rendered logo image. */
  size?: number;
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
      <Image
        src={LOGO_SRC}
        alt="XportACar"
        width={size}
        height={size}
        priority
        className="h-auto w-auto rounded-md object-contain"
        style={{ height: size }}
      />
      {withWordmark && (
        <span className="text-lg">
          Xport<span className="text-brand-600">A</span>Car
        </span>
      )}
    </Link>
  );
}
