// Serializable icon registry.
//
// React component values can't cross the Server → Client component boundary
// (the RSC payload only carries serializable data — strings, numbers, plain
// objects, etc.). To pass a Lucide icon from a Server Component, we send
// a string name through the registry below and let the Client Component
// resolve it back to a component.
//
// Add new icons here as needed.

import {
  ArrowDownRight, ArrowUpRight,
  BadgeDollarSign, BadgeEuro,
  Calendar, Camera, Car, CheckCircle2, ClipboardCheck, Container,
  FileCheck2, Gavel, LayoutDashboard,
  Search, Settings, ShieldCheck,
  TrendingUp, Truck, UserCheck, Users,
  type LucideIcon,
} from "lucide-react";

const REGISTRY = {
  "arrow-down-right": ArrowDownRight,
  "arrow-up-right":   ArrowUpRight,
  "badge-dollar":     BadgeDollarSign,
  "badge-euro":       BadgeEuro,
  "calendar":         Calendar,
  "camera":           Camera,
  "car":              Car,
  "check-circle":     CheckCircle2,
  "clipboard-check":  ClipboardCheck,
  "container":        Container,
  "file-check":       FileCheck2,
  "gavel":            Gavel,
  "layout-dashboard": LayoutDashboard,
  "search":           Search,
  "settings":         Settings,
  "shield-check":     ShieldCheck,
  "trending-up":      TrendingUp,
  "truck":            Truck,
  "user-check":       UserCheck,
  "users":            Users,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof REGISTRY;

export function resolveIcon(name: IconName): LucideIcon {
  return REGISTRY[name];
}

/** Convenience component — render `<Icon name="gavel" className="size-5" />`. */
export function Icon({
  name, className,
}: {
  name: IconName;
  className?: string;
}) {
  const C = REGISTRY[name];
  return <C className={className} />;
}
