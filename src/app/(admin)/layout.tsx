import { redirect } from "next/navigation";

import { AdminSidebar, AdminTopBar } from "@/components/layout/AdminSidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/dashboard");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  const profile: Profile | null = data ?? null;

  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    redirect("/");
  }

  // Pending-KYC badge count (distinct buyers with a pending submission).
  const { data: pendingRows } = await supabase
    .from("kyc_submissions").select("user_id").eq("status", "pending");
  const pendingKyc = new Set((pendingRows ?? []).map((r) => (r as { user_id: string }).user_id)).size;

  return (
    <div className="min-h-screen bg-grey-50">
      <AdminSidebar profile={profile} pendingKyc={pendingKyc} />
      <AdminTopBar profile={profile} pendingKyc={pendingKyc} />
      <main className="lg:pl-64">
        {/* Desktop top bar — holds the user menu (top-right) so admins can
            reach profile / sign out without a crash. */}
        <header className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-2 border-b border-grey-200 bg-white/90 px-6 backdrop-blur lg:flex">
          <LanguageSwitcher variant="ghost" />
          <UserMenu profile={profile} variant="admin" />
        </header>
        <div className="min-h-[calc(100vh-4rem)] bg-grey-50 text-grey-900 lg:min-h-[calc(100vh-3.5rem)]">
          {children}
        </div>
      </main>
    </div>
  );
}
