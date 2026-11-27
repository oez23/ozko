import type { Metadata } from "next";
import Link from "next/link";
import { MIN_COMPARABLES } from "@immo/core";
import { MatchSummary } from "@/components/match";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { matchRequestsForProperty } from "@/lib/data/matching";
import { getPriceHistory, getProperty, valueProperty } from "@/lib/data/properties";
import {
  DEAL_TYPE_LABELS, formatDate, formatNumber, formatPrice, PROPERTY_TYPE_LABELS, STATUS_LABELS,
} from "@/lib/labels";
import { orNotFound, uuidParam } from "@/lib/params";

export const metadata: Metadata = { title: "Objekt" };

const CONFIDENCE_LABELS = { low: "niedrig", medium: "mittel", high: "hoch" } as const;

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const id = uuidParam((await params).id);
  const { property: p, agentName, canEdit } = await orNotFound(getProperty(session, id));
  const [matches, history, valuation] = await Promise.all([
    matchRequestsForProperty(session, p),
    getPriceHistory(session, id),
    valueProperty(session, p),
  ]);

  const facts: [string, string][] = [
    ["Objektart", PROPERTY_TYPE_LABELS[p.propertyType]],
    ["Vermarktung", DEAL_TYPE_LABELS[p.dealType]],
    ["Lage", [p.city, p.district].filter(Boolean).join(", ")],
    ["Adresse", p.address ?? "–"],
    ["Fläche", p.areaSqm ? `${formatNumber(p.areaSqm)} m²` : "–"],
    ["Zimmer", p.rooms != null ? formatNumber(p.rooms) : "–"],
    ["Bäder", p.bathrooms != null ? String(p.bathrooms) : "–"],
    ["Etage", p.floor != null ? String(p.floor) : "–"],
    ["Baujahr", p.yearBuilt != null ? String(p.yearBuilt) : "–"],
    ["Auftrag endet", p.mandateEndsOn ? formatDate(p.mandateEndsOn) : "–"],
    ["Makler", agentName],
  ];

  return (
    <>
      <PageHeader title={p.title}
        subtitle={`${formatPrice(p.price, p.currency)}${p.areaSqm ? ` · ${formatPrice(Math.round(p.price / p.areaSqm), p.currency)}/m²` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={p.status === "active" ? "brand" : "neutral"}>{STATUS_LABELS[p.status]}</Badge>
            {canEdit ? <LinkButton href={`/app/portfolio/${id}/edit`} variant="secondary">Bearbeiten</LinkButton> : null}
          </div>
        } />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card title="Eckdaten">
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
          <Card title={`Passende Suchaufträge (${matches.length})`}>
            {matches.length === 0 ? (
              <p className="text-sm text-muted">
                {p.status === "active" ? "Aktuell kein passender Suchauftrag im Büro." : "Matching läuft nur für aktive Objekte."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {matches.map((m) => (
                  <li key={m.requestId} className="flex flex-col gap-2 py-3 text-sm">
                    {m.contact ? (
                      <Link href={`/app/contacts/${m.contact.id}`} className="font-medium text-brand underline">{m.contact.fullName}</Link>
                    ) : (
                      <span className="font-medium">Kunde von {m.agentName}</span>
                    )}
                    <MatchSummary match={m.match} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Marktwert-Einschätzung">
            {valuation.ok ? (
              <div className="text-sm">
                <p className="text-2xl font-semibold tabular-nums">{formatPrice(valuation.estimate.mid, p.currency)}</p>
                <p className="mt-1 text-muted tabular-nums">
                  Spanne {formatPrice(valuation.estimate.low, p.currency)} – {formatPrice(valuation.estimate.high, p.currency)}
                </p>
                <p className="mt-3 text-muted">
                  Median {formatPrice(valuation.pricePerSqm.median, p.currency)}/m² aus {valuation.comparablesUsed} Vergleichsobjekten
                  des Büros · Aussagekraft {CONFIDENCE_LABELS[valuation.confidence]}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {valuation.reason === "missing_area"
                  ? "Für eine Einschätzung fehlt die Fläche des Objekts."
                  : `Zu wenige Vergleichsobjekte: ${valuation.comparablesUsed} von mindestens ${MIN_COMPARABLES} (gleiche Art, Stadt, Währung, ähnliche Fläche).`}
              </p>
            )}
          </Card>
          <Card title="Preis- und Statusverlauf">
            <ol className="flex flex-col gap-2 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-muted tabular-nums">{formatDate(h.createdAt)}</span>
                  <span className="tabular-nums">{formatPrice(h.price, p.currency)} · {STATUS_LABELS[h.status]}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
