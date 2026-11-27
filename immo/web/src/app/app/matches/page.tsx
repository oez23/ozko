import type { Metadata } from "next";
import Link from "next/link";
import { dismiss, markSeen } from "@/app/actions/matches";
import { MatchSummary } from "@/components/match";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { listMatchInbox } from "@/lib/data/matching";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.matches.title };
}

export default async function MatchesPage() {
  const session = await requireSession();
  const { m, f } = await getI18n();
  const t = m.matches;
  const inbox = await listMatchInbox(session);
  const newCount = inbox.filter((item) => item.isNew).length;

  return (
    <>
      <PageHeader title={t.title} subtitle={newCount > 0 ? fill(t.newCount, { count: newCount }) : t.subtitle}
        action={newCount > 0 ? <form action={markSeen}><Button type="submit" variant="secondary">{t.markSeen}</Button></form> : undefined} />
      {inbox.length === 0 ? (
        <EmptyState title={t.empty}>{t.emptyHint}</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {inbox.map(({ requestId, contact, property, network, match, isNew }) => (
            <li key={`${requestId}:${property.id}`} className="flex flex-col gap-2 px-4 py-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isNew ? <Badge tone="warn">{t.isNew}</Badge> : null}
                  <Link href={network ? `/app/network/${property.id}` : `/app/portfolio/${property.id}`}
                    className="font-medium text-brand underline">{property.title}</Link>
                  {network ? <Badge>{fill(t.network, { office: network.orgName })}</Badge> : null}
                </div>
                <span className="font-medium tabular-nums">{f.price(property.price, property.currency)}</span>
              </div>
              <p className="text-muted">
                <Link href={`/app/contacts/${contact.id}`} className="underline">{fill(t.forCustomer, { name: contact.fullName })}</Link>
                {" · "}{[property.city, property.district].filter(Boolean).join(", ")}
                {" · "}{f.area(property.areaSqm)} · {f.rooms(property.rooms, property.livingRooms)}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <MatchSummary match={match} m={m} />
                <form action={dismiss.bind(null, requestId, property.id)}>
                  <button type="submit" className="text-xs font-medium text-muted underline">{t.dismiss}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
