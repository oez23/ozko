import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, EmptyState, Input, LinkButton, PageHeader } from "@/components/ui";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { listContacts } from "@/lib/data/contacts";
import { first, type SearchParams } from "@/lib/params";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.contacts.title };
}

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const { m } = await getI18n();
  const t = m.contacts;
  const q = first((await searchParams).q)?.slice(0, 100);
  const rows = await listContacts(session, q);
  return (
    <>
      <PageHeader title={t.title} subtitle={session.role === "agent" ? t.subtitleOwn : t.subtitleAll}
        action={<LinkButton href="/app/contacts/new">{t.add}</LinkButton>} />
      <form method="get" className="mb-5 flex max-w-md gap-2">
        <Input name="q" type="search" defaultValue={q} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        <Button type="submit" variant="secondary">{m.common.search}</Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map(({ contact, agentName, requestCount }) => (
            <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <Link href={`/app/contacts/${contact.id}`} className="font-medium text-brand underline">{contact.fullName}</Link>
                <p className="text-xs text-muted">{[contact.phone, contact.email].filter(Boolean).join(" · ") || t.noContactData}</p>
              </div>
              <div className="flex items-center gap-2">
                {requestCount > 0 ? <Badge tone="brand">{fill(t.requestCount, { count: requestCount })}</Badge> : null}
                <Badge>{m.enums.contactKind[contact.kind]}</Badge>
                {session.role !== "agent" ? <span className="text-xs text-muted">{agentName}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
