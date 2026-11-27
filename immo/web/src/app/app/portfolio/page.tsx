import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DEAL_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES } from "@immo/core";
import { Badge, Button, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listProperties } from "@/lib/data/properties";
import { DEAL_TYPE_LABELS, formatNumber, formatPrice, PROPERTY_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { first, type SearchParams } from "@/lib/params";

export const metadata: Metadata = { title: "Portfolio" };

/** Invalid filter values are dropped rather than rejected: a stale bookmark should still open the list. */
const filterSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  dealType: z.enum(DEAL_TYPES).optional().catch(undefined),
  propertyType: z.enum(PROPERTY_TYPES).optional().catch(undefined),
  status: z.enum(PROPERTY_STATUSES).optional().catch(undefined),
  city: z.string().max(80).optional().catch(undefined),
  minPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  mine: z.literal("1").optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function PortfolioPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const raw = await searchParams;
  const params = Object.fromEntries(Object.keys(filterSchema.shape).map((key) => [key, first(raw[key])]));
  const filters = filterSchema.parse(params);
  const { rows, total, page, pages } = await listProperties(session, { ...filters, mine: filters.mine === "1" });

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") query.set(key, value);
    query.set("page", String(target));
    return `/app/portfolio?${query}`;
  };

  return (
    <>
      <PageHeader title="Portfolio" subtitle={`${total} Objekte`}
        action={
          <div className="flex gap-2">
            <LinkButton href="/app/portfolio/import" variant="secondary">CSV-Import</LinkButton>
            <LinkButton href="/app/portfolio/new">Objekt anlegen</LinkButton>
          </div>
        } />
      <form method="get" className="mb-5 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Suche
          <Input name="q" type="search" defaultValue={filters.q} placeholder="Titel, Stadtteil, Adresse" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Stadt
          <Input name="city" defaultValue={filters.city} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Vermarktung
          <Select name="dealType" defaultValue={filters.dealType ?? ""}>
            <option value="">Alle</option>
            {DEAL_TYPES.map((v) => <option key={v} value={v}>{DEAL_TYPE_LABELS[v]}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Objektart
          <Select name="propertyType" defaultValue={filters.propertyType ?? ""}>
            <option value="">Alle</option>
            {PROPERTY_TYPES.map((v) => <option key={v} value={v}>{PROPERTY_TYPE_LABELS[v]}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Status
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Alle</option>
            {PROPERTY_STATUSES.map((v) => <option key={v} value={v}>{STATUS_LABELS[v]}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Preis von
          <Input name="minPrice" type="number" min={0} defaultValue={filters.minPrice} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Preis bis
          <Input name="maxPrice" type="number" min={0} defaultValue={filters.maxPrice} />
        </label>
        <div className="flex items-end justify-between gap-3">
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine === "1"} className="size-4 accent-brand" />
            Nur meine
          </label>
          <div className="flex gap-2">
            <LinkButton href="/app/portfolio" variant="secondary">Zurücksetzen</LinkButton>
            <Button type="submit">Filtern</Button>
          </div>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Keine Objekte gefunden">
          Filter anpassen oder ein <Link href="/app/portfolio/new" className="text-brand underline">Objekt anlegen</Link>.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Objekt</th>
                <th scope="col" className="px-4 py-3 font-medium">Lage</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Fläche</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Zimmer</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Preis</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Makler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ property: p, agentName }) => (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link href={`/app/portfolio/${p.id}`} className="font-medium text-brand underline">{p.title}</Link>
                    <p className="text-xs text-muted">{PROPERTY_TYPE_LABELS[p.propertyType]} · {DEAL_TYPE_LABELS[p.dealType]}</p>
                  </td>
                  <td className="px-4 py-3">{p.city}{p.district ? `, ${p.district}` : ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.areaSqm ? `${formatNumber(p.areaSqm)} m²` : "–"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.rooms != null ? formatNumber(p.rooms) : "–"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatPrice(p.price, p.currency)}</td>
                  <td className="px-4 py-3"><Badge tone={p.status === "active" ? "brand" : "neutral"}>{STATUS_LABELS[p.status]}</Badge></td>
                  <td className="px-4 py-3 text-muted">{agentName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Seiten" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <LinkButton href={pageHref(page - 1)} variant="secondary">Zurück</LinkButton> : <span />}
          <span className="text-muted">Seite {page} von {pages}</span>
          {page < pages ? <LinkButton href={pageHref(page + 1)} variant="secondary">Weiter</LinkButton> : <span />}
        </nav>
      ) : null}
    </>
  );
}
