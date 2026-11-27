import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PropertyForm, type PropertyFormValues } from "@/components/property-form";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { listContacts } from "@/lib/data/contacts";
import { getProperty } from "@/lib/data/properties";
import { orNotFound, uuidParam } from "@/lib/params";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.property.editTitle };
}

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { m } = await getI18n();
  const id = uuidParam((await params).id);
  const [{ property, canEdit }, contacts] = await Promise.all([orNotFound(getProperty(session, id)), listContacts(session)]);
  if (!canEdit) notFound();

  const values: PropertyFormValues = {};
  for (const [key, value] of Object.entries(property)) {
    if (value !== null && value !== undefined) (values as Record<string, string>)[key] = String(value);
  }
  return (
    <>
      <PageHeader title={m.property.editTitle} subtitle={property.title} />
      <Card>
        <PropertyForm id={id} values={values} contacts={contacts.map(({ contact }) => ({ id: contact.id, fullName: contact.fullName }))} />
      </Card>
    </>
  );
}
