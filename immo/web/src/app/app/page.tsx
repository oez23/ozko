import type { Metadata } from "next";
import Link from "next/link";
import { PROPERTY_STATUSES } from "@immo/core";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { countByStatus, listExpiringMandates } from "@/lib/data/properties";
import { formatDate, STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Übersicht" };

export default async function Dashboard() {
  const session = await requireSession();
  const [counts, expiring] = await Promise.all([countByStatus(session), listExpiringMandates(session, 30)]);
  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  return (
    <>
      <PageHeader title={`Hallo ${session.fullName.split(" ")[0]}`} subtitle={session.orgName}
        action={<LinkButton href="/app/portfolio/new">Objekt anlegen</LinkButton>} />
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PROPERTY_STATUSES.map((status) => (
          <Link key={status} href={`/app/portfolio?status=${status}`}
            className="rounded-lg border border-line bg-surface p-4 hover:border-brand">
            <dt className="text-xs text-muted">{STATUS_LABELS[status]}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{byStatus.get(status) ?? 0}</dd>
          </Link>
        ))}
      </dl>
      <Card title="Aufträge, die in 30 Tagen enden">
        {expiring.length === 0 ? (
          <p className="text-sm text-muted">Keine auslaufenden Aufträge.</p>
        ) : (
          <ul className="divide-y divide-line">
            {expiring.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/app/portfolio/${p.id}`} className="font-medium text-brand underline">{p.title}</Link>
                <span className="text-muted tabular-nums">{formatDate(p.mandateEndsOn!)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
