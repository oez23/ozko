import type { Metadata } from "next";
import Link from "next/link";
import { toggleBuyerRequest } from "@/app/actions/contacts";
import { BuyerRequestForm } from "@/components/contact-forms";
import { MatchSummary } from "@/components/match";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getContact, listRequestsForContact } from "@/lib/data/contacts";
import { matchPropertiesForRequest } from "@/lib/data/matching";
import { CONTACT_KIND_LABELS, DEAL_TYPE_LABELS, formatPrice, PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { orNotFound, uuidParam } from "@/lib/params";

export const metadata: Metadata = { title: "Kontakt" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const id = uuidParam((await params).id);
  const contact = await orNotFound(getContact(session, id));
  const requests = await listRequestsForContact(session, id);
  const matches = await Promise.all(requests.map((request) => matchPropertiesForRequest(session, request)));

  return (
    <>
      <PageHeader title={contact.fullName}
        subtitle={[contact.phone, contact.email].filter(Boolean).join(" · ") || undefined}
        action={<Badge>{CONTACT_KIND_LABELS[contact.kind]}</Badge>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          {contact.notes ? <Card title="Notizen"><p className="text-sm whitespace-pre-line">{contact.notes}</p></Card> : null}
          {requests.map((request, index) => {
            const budget = [request.minPrice, request.maxPrice].map((v) => (v != null ? formatPrice(v, request.currency) : "offen")).join(" – ");
            return (
              <Card key={request.id}
                title={`${DEAL_TYPE_LABELS[request.dealType]} in ${request.city}`}
                action={
                  <form action={toggleBuyerRequest.bind(null, request.id, !request.active)}>
                    <button type="submit" className="text-sm font-medium text-brand underline">
                      {request.active ? "Pausieren" : "Aktivieren"}
                    </button>
                  </form>
                }>
                <p className="text-sm text-muted">
                  {request.propertyTypes.map((t) => PROPERTY_TYPE_LABELS[t]).join(", ")} · Budget {budget}
                  {request.districts.length > 0 ? ` · ${request.districts.join(", ")}` : ""}
                  {request.minRooms != null ? ` · ab ${request.minRooms} Zimmer` : ""}
                </p>
                {!request.active ? (
                  <p className="mt-3 text-sm text-muted">Pausiert – kein Matching.</p>
                ) : matches[index]!.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Noch kein passendes Objekt im Portfolio.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {matches[index]!.map(({ property, match }) => (
                      <li key={property.id} className="flex flex-col gap-2 py-3 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link href={`/app/portfolio/${property.id}`} className="font-medium text-brand underline">{property.title}</Link>
                          <span className="tabular-nums">{formatPrice(property.price, property.currency)}</span>
                        </div>
                        <MatchSummary match={match} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
        <Card title="Neuer Suchauftrag"><BuyerRequestForm contactId={id} /></Card>
      </div>
    </>
  );
}
