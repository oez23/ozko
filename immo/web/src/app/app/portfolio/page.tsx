import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DEAL_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES } from "@immo/core";
import { Badge, Button, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { listProperties } from "@/lib/data/properties";
import { first, type SearchParams } from "@/lib/params";
import { MAX_PRESENTATION_ITEMS } from "@/lib/pdf/limits";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.portfolio.title };
}

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

const labelClass = "flex flex-col gap-1 text-xs font-medium text-muted";

export default async function PortfolioPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const { m, f } = await getI18n();
  const t = m.portfolio;
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
      <PageHeader title={t.title} subtitle={fill(t.count, { count: total })}
        action={
          <div className="flex gap-2">
            <LinkButton href="/app/portfolio/import" variant="secondary">{t.import}</LinkButton>
            <LinkButton href="/app/portfolio/new">{m.dashboard.newProperty}</LinkButton>
          </div>
        } />
      <form method="get" className="mb-5 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>{t.searchLabel}
          <Input name="q" type="search" defaultValue={filters.q} placeholder={t.searchPlaceholder} />
        </label>
        <label className={labelClass}>{m.property.city}
          <Input name="city" defaultValue={filters.city} />
        </label>
        <label className={labelClass}>{m.property.dealType}
          <Select name="dealType" defaultValue={filters.dealType ?? ""}>
            <option value="">{m.common.all}</option>
            {DEAL_TYPES.map((v) => <option key={v} value={v}>{m.enums.dealType[v]}</option>)}
          </Select>
        </label>
        <label className={labelClass}>{m.property.propertyType}
          <Select name="propertyType" defaultValue={filters.propertyType ?? ""}>
            <option value="">{m.common.all}</option>
            {PROPERTY_TYPES.map((v) => <option key={v} value={v}>{m.enums.propertyType[v]}</option>)}
          </Select>
        </label>
        <label className={labelClass}>{m.property.status}
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">{m.common.all}</option>
            {PROPERTY_STATUSES.map((v) => <option key={v} value={v}>{m.enums.status[v]}</option>)}
          </Select>
        </label>
        <label className={labelClass}>{t.priceFrom}
          <Input name="minPrice" type="number" min={0} defaultValue={filters.minPrice} />
        </label>
        <label className={labelClass}>{t.priceTo}
          <Input name="maxPrice" type="number" min={0} defaultValue={filters.maxPrice} />
        </label>
        <div className="flex items-end justify-between gap-3">
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine === "1"} className="size-4 accent-brand" />
            {t.onlyMine}
          </label>
          <div className="flex gap-2">
            <LinkButton href="/app/portfolio" variant="secondary">{m.common.reset}</LinkButton>
            <Button type="submit">{m.common.filter}</Button>
          </div>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={t.emptyTitle}>{t.emptyHint}</EmptyState>
      ) : (
        <form method="get" action="/app/presentation.pdf" target="_blank">
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3"><span className="sr-only">PDF</span></th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.colProperty}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.colLocation}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t.colArea}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t.colRooms}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t.colPrice}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.colStatus}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.colAgent}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ property: p, agentName }) => (
                  <tr key={p.id} className="hover:bg-canvas">
                    <td className="px-4 py-3">
                      <input type="checkbox" name="ids" value={p.id} aria-label={fill(t.select, { title: p.title })} className="size-4 accent-brand" />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/app/portfolio/${p.id}`} className="font-medium text-brand underline">{p.title}</Link>
                      <p className="text-xs text-muted">{m.enums.propertyType[p.propertyType]} · {m.enums.dealType[p.dealType]}</p>
                    </td>
                    <td className="px-4 py-3">{[p.city, p.district].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.area(p.areaSqm)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.rooms(p.rooms, p.livingRooms)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{f.price(p.price, p.currency)}</td>
                    <td className="px-4 py-3"><Badge tone={p.status === "active" ? "brand" : "neutral"}>{m.enums.status[p.status]}</Badge></td>
                    <td className="px-4 py-3 text-muted">{agentName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary">{t.presentation}</Button>
            <p className="text-xs text-muted">{fill(t.presentationHint, { max: MAX_PRESENTATION_ITEMS })}</p>
          </div>
        </form>
      )}

      {pages > 1 ? (
        <nav aria-label={m.common.pages} className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <LinkButton href={pageHref(page - 1)} variant="secondary">{m.common.back}</LinkButton> : <span />}
          <span className="text-muted">{fill(m.common.pageOf, { page, pages })}</span>
          {page < pages ? <LinkButton href={pageHref(page + 1)} variant="secondary">{m.common.next}</LinkButton> : <span />}
        </nav>
      ) : null}
    </>
  );
}
