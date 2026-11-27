import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { m } = await getI18n();
  const nav = [
    { href: "/app", label: m.nav.dashboard },
    { href: "/app/portfolio", label: m.nav.portfolio },
    { href: "/app/contacts", label: m.nav.contacts },
    { href: "/app/team", label: m.nav.team },
    { href: "/app/settings", label: m.nav.settings },
  ];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-surface md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:block md:px-5 md:py-6">
          <div>
            <p className="font-semibold text-brand">{m.brand}</p>
            <p className="truncate text-xs text-muted">{session.orgName}</p>
          </div>
          <nav aria-label={m.nav.main} className="flex gap-1 overflow-x-auto md:mt-6 md:flex-col">
            {nav.map((item) => (
              <Link key={item.href} href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-ink hover:bg-brand-soft">
                {item.label}
              </Link>
            ))}
            <form action={logout} className="md:hidden">
              <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-brand">
                {m.nav.logout}
              </button>
            </form>
          </nav>
        </div>
        <div className="hidden border-t border-line px-5 py-4 md:block">
          <p className="truncate text-sm font-medium">{session.fullName}</p>
          <p className="text-xs text-muted">{m.enums.role[session.role]}</p>
          <form action={logout} className="mt-3">
            <button type="submit" className="text-sm font-medium text-brand underline">{m.nav.logout}</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
