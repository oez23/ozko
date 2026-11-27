import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, EmptyState, Input, LinkButton, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listContacts } from "@/lib/data/contacts";
import { CONTACT_KIND_LABELS } from "@/lib/labels";
import { first, type SearchParams } from "@/lib/params";

export const metadata: Metadata = { title: "Kontakte" };

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const q = first((await searchParams).q)?.slice(0, 100);
  const rows = await listContacts(session, q);
  return (
    <>
      <PageHeader title="Kontakte"
        subtitle={session.role === "agent" ? "Ihre eigenen Kontakte" : "Alle Kontakte des Büros"}
        action={<LinkButton href="/app/contacts/new">Kontakt anlegen</LinkButton>} />
      <form method="get" className="mb-5 flex max-w-md gap-2">
        <Input name="q" type="search" defaultValue={q} placeholder="Name, E-Mail oder Telefon" aria-label="Kontakte durchsuchen" />
        <Button type="submit" variant="secondary">Suchen</Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Keine Kontakte gefunden" />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map(({ contact, agentName, requestCount }) => (
            <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <Link href={`/app/contacts/${contact.id}`} className="font-medium text-brand underline">{contact.fullName}</Link>
                <p className="text-xs text-muted">{[contact.phone, contact.email].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}</p>
              </div>
              <div className="flex items-center gap-2">
                {requestCount > 0 ? <Badge tone="brand">{requestCount} Suchauftrag{requestCount > 1 ? "e" : ""}</Badge> : null}
                <Badge>{CONTACT_KIND_LABELS[contact.kind]}</Badge>
                {session.role !== "agent" ? <span className="text-xs text-muted">{agentName}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
