import type { Metadata } from "next";
import { ImportForm } from "@/components/import-form";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.import.title };
}

export default async function ImportPage() {
  await requireSession();
  const { m } = await getI18n();
  const t = m.import;
  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t.upload}><ImportForm /></Card>
        <Card title={t.columns}>
          <p className="text-sm text-muted">{t.required} <code>{t.requiredColumns}</code></p>
          <p className="mt-2 text-sm text-muted">{t.optional} <code>{t.optionalColumns}</code></p>
          <p className="mt-2 text-sm text-muted">{t.aliases}</p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-canvas p-3 text-xs">{t.sample}</pre>
        </Card>
      </div>
    </>
  );
}
