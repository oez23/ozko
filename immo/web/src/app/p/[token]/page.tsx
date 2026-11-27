import type { Metadata } from "next";
import { PublicFacts } from "@/components/property-facts";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { resolveShare } from "@/lib/data/shares";

/** A private link for one customer: never index it, never let a referrer header carry the token elsewhere. */
export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.share.pageTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function SharedListingsPage({ params }: { params: Promise<{ token: string }> }) {
  const { m, f } = await getI18n();
  const share = await resolveShare((await params).token);
  if (!share) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
        <p className="w-full rounded-lg border border-line bg-surface p-6 text-center text-sm text-muted">{m.share.invalid}</p>
      </main>
    );
  }
  const phoneHref = share.agent.phone ? `tel:${share.agent.phone.replace(/[^\d+]/g, "")}` : null;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="border-t-4 border-brand pt-5">
        <p className="text-xs font-semibold tracking-wide text-brand">{share.orgName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{m.share.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted">{fill(m.share.pageLead, { agent: share.agent.fullName })}</p>
      </header>
      {share.properties.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">{m.share.empty}</p>
      ) : (
        <ol className="mt-6 flex flex-col gap-4">
          {share.properties.map((property, index) => (
            <li key={property.id} className="rounded-lg border border-line bg-surface p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{index + 1}. {property.title}</h2>
                <p className="text-lg font-semibold text-brand tabular-nums">{f.price(property.price, property.currency)}</p>
              </div>
              <PublicFacts property={property} m={m} f={f} />
            </li>
          ))}
        </ol>
      )}
      <footer className="mt-6 rounded-lg border border-line bg-surface p-5">
        <p className="text-xs text-muted">{m.share.contactAgent}</p>
        <p className="mt-1 font-medium">{share.agent.fullName}</p>
        <p className="text-sm text-muted">{share.orgName}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {phoneHref ? <a href={phoneHref} className="font-medium text-brand underline">{m.share.call}: {share.agent.phone}</a> : null}
          <a href={`mailto:${share.agent.email}`} className="font-medium text-brand underline">{share.agent.email}</a>
        </div>
      </footer>
    </main>
  );
}
