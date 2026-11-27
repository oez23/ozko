import type { Metadata } from "next";
import Link from "next/link";
import { toggleBuyerRequest } from "@/app/actions/contacts";
import { BuyerRequestForm } from "@/components/contact-forms";
import { MatchSummary } from "@/components/match";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { getContact, listRequestsForContact } from "@/lib/data/contacts";
import { matchPropertiesForRequest } from "@/lib/data/matching";
import { orNotFound, uuidParam } from "@/lib/params";
import { MAX_PRESENTATION_ITEMS } from "@/lib/pdf/limits";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.contacts.pageTitle };
}

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { m, f } = await getI18n();
  const t = m.request;
  const id = uuidParam((await params).id);
  const contact = await orNotFound(getContact(session, id));
  const requests = await listRequestsForContact(session, id);
  const matches = await Promise.all(requests.map((request) => matchPropertiesForRequest(session, request)));

  return (
    <>
      <PageHeader title={contact.fullName}
        subtitle={[contact.phone, contact.email].filter(Boolean).join(" · ") || undefined}
        action={<Badge>{m.enums.contactKind[contact.kind]}</Badge>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          {contact.notes ? <Card title={m.contacts.notes}><p className="text-sm whitespace-pre-line">{contact.notes}</p></Card> : null}
          {requests.map((request, index) => {
            const found = matches[index]!;
            const range = [request.minPrice, request.maxPrice]
              .map((v) => (v != null ? f.price(v, request.currency) : m.common.open))
              .join(" – ");
            const details = [
              request.propertyTypes.map((type) => m.enums.propertyType[type]).join(", "),
              fill(t.budget, { range }),
              request.districts.join(", "),
              request.minRooms != null ? fill(t.roomsFrom, { rooms: request.minRooms }) : "",
            ].filter(Boolean);
            const presentation = new URLSearchParams({ for: id });
            for (const { property } of found.slice(0, MAX_PRESENTATION_ITEMS)) presentation.append("ids", property.id);
            return (
              <Card key={request.id}
                title={fill(t.heading, { city: request.city, dealType: m.enums.dealType[request.dealType] })}
                action={
                  <form action={toggleBuyerRequest.bind(null, request.id, !request.active)}>
                    <button type="submit" className="text-sm font-medium text-brand underline">
                      {request.active ? t.pause : t.activate}
                    </button>
                  </form>
                }>
                <p className="text-sm text-muted">{details.join(" · ")}</p>
                {!request.active ? (
                  <p className="mt-3 text-sm text-muted">{t.paused}</p>
                ) : found.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{t.noMatches}</p>
                ) : (
                  <>
                    <ul className="mt-3 divide-y divide-line border-t border-line">
                      {found.map(({ property, match }) => (
                        <li key={property.id} className="flex flex-col gap-2 py-3 text-sm">
                          <div className="flex items-baseline justify-between gap-3">
                            <Link href={`/app/portfolio/${property.id}`} className="font-medium text-brand underline">{property.title}</Link>
                            <span className="tabular-nums">{f.price(property.price, property.currency)}</span>
                          </div>
                          <MatchSummary match={match} m={m} />
                        </li>
                      ))}
                    </ul>
                    <a href={`/app/presentation.pdf?${presentation}`} target="_blank" rel="noopener"
                      className="mt-2 inline-block text-sm font-medium text-brand underline">{t.presentation}</a>
                  </>
                )}
              </Card>
            );
          })}
        </div>
        <Card title={t.newTitle}><BuyerRequestForm contactId={id} /></Card>
      </div>
    </>
  );
}
