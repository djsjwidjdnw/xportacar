import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { formatRelativeTime, initials } from "@/lib/utils";
import type { Profile } from "@/types";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const t = await getTranslations("nav");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = (data as Profile | null) ?? {
    id: user.id,
    role: "buyer" as const,
    company_name: null,
    company_registration: null,
    phone: null,
    country: null,
    language: "en",
    kyc_status: "pending" as const,
    avatar_url: null,
    full_name: user.email ?? null,
    email: user.email ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">{t("profile")}</h1>
          <p className="mt-1 text-sm text-grey-600">
            Manage your trade account details — these appear on bids, watchlist, and shipping paperwork.
          </p>
        </header>

        <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar className="size-16">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
              <AvatarFallback className="bg-brand-100 text-base font-semibold text-brand-700">
                {initials(profile.full_name ?? user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-grey-900">{profile.full_name ?? user.email}</h2>
              {profile.company_name && (
                <p className="text-sm text-grey-500">{profile.company_name}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-grey-200 text-grey-700 capitalize">
                  {profile.role}
                </Badge>
                <Badge
                  className={
                    profile.kyc_status === "verified"
                      ? "bg-success-50 text-success-700 ring-1 ring-success-100"
                      : profile.kyc_status === "rejected"
                      ? "bg-error-50 text-error-700 ring-1 ring-error-100"
                      : "bg-warning-50 text-warning-700 ring-1 ring-warning-100"
                  }
                >
                  <ShieldCheck className="size-3" />
                  KYC {profile.kyc_status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-grey-500">
                Member since {formatRelativeTime(profile.created_at)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
          <h3 className="mb-5 text-lg font-bold text-grey-900">Account details</h3>
          <ProfileEditForm profile={profile} />
        </section>
      </div>
    </div>
  );
}
