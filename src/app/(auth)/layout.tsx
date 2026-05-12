import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-grey-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Logo />
        <LanguageSwitcher variant="outline" />
      </header>
      <main className="mx-auto flex max-w-md flex-col px-4 pb-16 sm:px-6">
        {children}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-grey-500 sm:px-6">
        <Link href="/" className="hover:text-grey-700">← Back to XportACar</Link>
      </footer>
    </div>
  );
}
