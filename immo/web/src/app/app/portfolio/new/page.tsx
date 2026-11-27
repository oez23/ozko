import type { Metadata } from "next";
import { PropertyForm } from "@/components/property-form";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { listContacts } from "@/lib/data/contacts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.property.newTitle };
}

export default async function NewPropertyPage() {
  const session = await requireSession();
  const { m } = await getI18n();
  const contacts = await listContacts(session);
  return (
    <>
      <PageHeader title={m.property.newTitle} />
      <Card>
        <PropertyForm id={null} contacts={contacts.map(({ contact }) => ({ id: contact.id, fullName: contact.fullName }))} />
      </Card>
    </>
  );
}
