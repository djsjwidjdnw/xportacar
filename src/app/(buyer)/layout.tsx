import { Suspense } from "react";

import { BuyerNav } from "@/components/layout/BuyerNav";
import { Footer } from "@/components/layout/Footer";
import { WelcomeToast } from "@/components/shared/WelcomeToast";
import { createClient } from "@/lib/supabase/server";
import type { Notification, Profile } from "@/types";

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let notifications: Notification[] = [];
  if (user) {
    const [{ data: p }, { data: n }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    profile = (p as Profile | null) ?? null;
    notifications = (n as Notification[] | null) ?? [];
  }

  return (
    <>
      <BuyerNav profile={profile} notifications={notifications} />
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
