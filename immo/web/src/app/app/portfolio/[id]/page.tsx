import type { Metadata } from "next";
import Link from "next/link";
import { MIN_COMPARABLES } from "@immo/core";
import { MatchSummary } from "@/components/match";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { matchRequestsForProperty } from "@/lib/data/matching";
import { getPriceHistory, getProperty, valueProperty } from "@/lib/data/properties";
import { orNotFound, uuidParam } from "@/lib/params";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.property.pageTitle };
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { m, f } = await getI18n();
  const t = m.property;
  const id = uuidParam((await params).id);
  const { property: p, agentName, canEdit } = await orNotFound(getProperty(session, id));
  const [matches, history, valuation] = await Promise.all([
    matchRequestsForProperty(session, p),
    getPriceHistory(session, id),
    valueProperty(session, p),
  ]);

  const dash = "–";
  const facts: [string, string][] = [
    [t.propertyType, m.enums.propertyType[p.propertyType]],
    [t.dealType, m.enums.dealType[p.dealType]],
    [t.location, [p.city, p.district].filter(Boolean).join(", ")],
    [t.address, p.address ?? dash],
    [t.area, f.area(p.areaSqm)],
    [t.roomsDisplay, f.rooms(p.rooms, p.livingRooms)],
    [t.bathrooms, p.bathrooms != null ? String(p.bathrooms) : dash],
    [t.floor, p.floor != null ? String(p.floor) : dash],
    [t.yearBuilt, p.yearBuilt != null ? String(p.yearBuilt) : dash],
    [t.mandateEndsOn, p.mandateEndsOn ? f.date(p.mandateEndsOn) : dash],
    [t.agent, agentName],
  ];
  const perSqm = p.areaSqm ? ` · ${f.price(Math.round(p.price / p.areaSqm), p.currency)}${m.common.perSqm}` : "";

  return (
    <>
      <PageHeader title={p.title} subtitle={`${f.price(p.price, p.currency)}${perSqm}`}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={p.status === "active" ? "brand" : "neutral"}>{m.enums.status[p.status]}</Badge>
            {p.sharedWithNetwork ? <Badge>{m.network.shareProperty}</Badge> : null}
            {canEdit ? <LinkButton href={`/app/portfolio/${id}/edit`} variant="secondary">{m.common.edit}</LinkButton> : null}
          </div>
        } />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card title={t.facts}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-0.5 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {p.description ? <p className="mt-5 border-t border-line pt-4 text-sm whitespace-pre-line">{p.description}</p> : null}
          </Card>
          <Card title={fill(t.matchesTitle, { count: matches.length })}>
            {matches.length === 0 ? (
              <p className="text-sm text-muted">{p.status === "active" ? t.noMatches : t.matchesInactive}</p>
            ) : (
              <ul className="divide-y divide-line">
                {matches.map((match) => (
                  <li key={match.requestId} className="flex flex-col gap-2 py-3 text-sm">
                    {match.contact ? (
                      <Link href={`/app/contacts/${match.contact.id}`} className="font-medium text-brand underline">{match.contact.fullName}</Link>
                    ) : match.network ? (
                      <span className="font-medium">
                        {fill(m.network.buyerAt, { agent: match.network.agentName, office: match.network.orgName })}
                        {match.network.agentPhone ? ` · ${match.network.agentPhone}` : ""}
                      </span>
                    ) : (
                      <span className="font-medium">{fill(t.colleagueCustomer, { agent: match.agentName })}</span>
                    )}
                    <MatchSummary match={match.match} m={m} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title={t.valuationTitle}>
            {valuation.ok ? (
              <div className="text-sm">
                <p className="text-2xl font-semibold tabular-nums">{f.price(valuation.estimate.mid, p.currency)}</p>
                <p className="mt-1 text-muted tabular-nums">
                  {fill(t.valuationRange, {
                    low: f.price(valuation.estimate.low, p.currency), high: f.price(valuation.estimate.high, p.currency),
                  })}
                </p>
                <p className="mt-3 text-muted">
                  {fill(t.valuationBasis, {
                    median: f.price(valuation.pricePerSqm.median, p.currency), count: valuation.comparablesUsed,
                    confidence: m.enums.confidence[valuation.confidence],
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {valuation.reason === "missing_area"
                  ? t.valuationMissingArea
                  : fill(t.valuationTooFew, { count: valuation.comparablesUsed, min: MIN_COMPARABLES })}
              </p>
            )}
            <a href={`/app/portfolio/${id}/report.pdf`} target="_blank" rel="noopener"
              className="mt-4 inline-block text-sm font-medium text-brand underline">{t.report}</a>
          </Card>
          <Card title={t.historyTitle}>
            <ol className="flex flex-col gap-2 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-muted tabular-nums">{f.date(h.createdAt)}</span>
                  <span className="tabular-nums">{f.price(h.price, p.currency)} · {m.enums.status[h.status]}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
