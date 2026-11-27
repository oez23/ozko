import type { Metadata } from "next";
import { PropertyForm } from "@/components/property-form";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listContacts } from "@/lib/data/contacts";

export const metadata: Metadata = { title: "Objekt anlegen" };

export default async function NewPropertyPage() {
  const session = await requireSession();
  const contacts = await listContacts(session);
  return (
    <>
      <PageHeader title="Objekt anlegen" />
      <Card>
        <PropertyForm id={null} contacts={contacts.map(({ contact }) => ({ id: contact.id, fullName: contact.fullName }))} />
      </Card>
    </>
  );
}
