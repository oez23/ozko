import type { Metadata } from "next";
import Link from "next/link";
import { toggleBuyerRequest } from "@/app/actions/contacts";
import { dismiss, revokeShareLink } from "@/app/actions/matches";
import { BuyerRequestForm } from "@/components/contact-forms";
import { MatchSummary } from "@/components/match";
import { ShareLinkButton } from "@/components/share-link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { getContact, listRequestsForContact } from "@/lib/data/contacts";
import { matchPropertiesForRequest } from "@/lib/data/matching";
import { listSharesForContact } from "@/lib/data/shares";
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
  const sent = await listSharesForContact(session, id);

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
            // Only the office's own listings go to the customer; a network listing belongs to another office.
            const ownIds = found.filter((item) => !item.network).slice(0, MAX_PRESENTATION_ITEMS).map((item) => item.property.id);
            const presentation = new URLSearchParams({ for: id });
            for (const propertyId of ownIds) presentation.append("ids", propertyId);
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
                      {found.map(({ property, network, match }) => (
                        <li key={property.id} className="flex flex-col gap-2 py-3 text-sm">
                          <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <span className="flex flex-wrap items-center gap-2">
                              <Link href={network ? `/app/network/${property.id}` : `/app/portfolio/${property.id}`}
                                className="font-medium text-brand underline">{property.title}</Link>
                              {network ? <Badge>{fill(m.matches.network, { office: network.orgName })}</Badge> : null}
                            </span>
                            <span className="tabular-nums">{f.price(property.price, property.currency)}</span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <MatchSummary match={match} m={m} />
                            <form action={dismiss.bind(null, request.id, property.id)}>
                              <button type="submit" className="text-xs font-medium text-muted underline">{m.matches.dismiss}</button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {ownIds.length > 0 ? (
                      <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
                        <ShareLinkButton contactId={id} propertyIds={ownIds} />
                        <a href={`/app/presentation.pdf?${presentation}`} target="_blank" rel="noopener"
                          className="text-sm font-medium text-brand underline">{t.presentation}</a>
                        {ownIds.length < found.length ? <p className="text-xs text-muted">{m.share.networkExcluded}</p> : null}
                      </div>
                    ) : null}
                  </>
                )}
              </Card>
            );
          })}
          {sent.length > 0 ? (
            <Card title={m.share.listTitle}>
              <ul className="divide-y divide-line text-sm">
                {sent.map((share) => (
                  <li key={share.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span>
                      {fill(m.share.listItem, { date: f.date(share.createdAt), count: share.count, views: share.viewCount })}
                      <span className="block text-xs text-muted">
                        {share.lastViewedAt ? fill(m.share.lastViewed, { date: f.date(share.lastViewedAt) }) : m.share.neverViewed}
                      </span>
                    </span>
                    <form action={revokeShareLink.bind(null, share.id)}>
                      <button type="submit" className="text-xs font-medium text-danger underline">{m.share.revoke}</button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
        <Card title={t.newTitle}><BuyerRequestForm contactId={id} /></Card>
      </div>
    </>
  );
}
