import type { Metadata } from "next";
import { PublicFacts } from "@/components/property-facts";
import { Alert, Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { getNetworkProperty } from "@/lib/data/matching";
import { orNotFound, uuidParam } from "@/lib/params";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.network.title };
}

export default async function NetworkPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { m, f } = await getI18n();
  const { property, party } = await orNotFound(getNetworkProperty(session, uuidParam((await params).id)));
  return (
    <>
      <PageHeader title={property.title} subtitle={f.price(property.price, property.currency)} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Alert tone="warn">{m.network.notice}</Alert>
          <Card title={m.property.facts}><PublicFacts property={property} m={m} f={f} /></Card>
        </div>
        <Card title={m.network.contact}>
          <p className="font-medium">{party.agentName}</p>
          <p className="text-sm text-muted">{m.network.office}: {party.orgName}</p>
          {party.agentPhone ? (
            <a href={`tel:${party.agentPhone.replace(/[^\d+]/g, "")}`} className="mt-3 inline-block font-medium text-brand underline">{party.agentPhone}</a>
          ) : (
            <p className="mt-3 text-sm text-muted">{m.network.noPhone}</p>
          )}
        </Card>
      </div>
    </>
  );
}
