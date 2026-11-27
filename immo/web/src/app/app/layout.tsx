import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";

const NAV = [
  { href: "/app", label: "Übersicht" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/contacts", label: "Kontakte" },
  { href: "/app/team", label: "Team" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-surface md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:block md:px-5 md:py-6">
          <div>
            <p className="font-semibold text-brand">Ozko Immo</p>
            <p className="truncate text-xs text-muted">{session.orgName}</p>
          </div>
          <nav aria-label="Hauptnavigation" className="flex gap-1 overflow-x-auto md:mt-6 md:flex-col">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-ink hover:bg-brand-soft">
                {item.label}
              </Link>
            ))}
            <form action={logout} className="md:hidden">
              <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-brand">
                Abmelden
              </button>
            </form>
          </nav>
        </div>
        <div className="hidden border-t border-line px-5 py-4 md:block">
          <p className="truncate text-sm font-medium">{session.fullName}</p>
          <p className="text-xs text-muted">{ROLE_LABELS[session.role]}</p>
          <form action={logout} className="mt-3">
            <button type="submit" className="text-sm font-medium text-brand underline">Abmelden</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
