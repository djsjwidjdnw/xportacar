import { redirect } from "next/navigation";

import { AdminSidebar, AdminTopBar } from "@/components/layout/AdminSidebar";
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

  return (
    <div className="min-h-screen bg-grey-50 dark">
      <AdminSidebar profile={profile} />
      <AdminTopBar profile={profile} />
      <main className="lg:pl-64">
        <div className="bg-white text-grey-900 dark:bg-grey-50 min-h-[calc(100vh-4rem)] lg:min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
