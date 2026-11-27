import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-forms";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.contacts.newTitle };
}

export default async function NewContactPage() {
  await requireSession();
  const { m } = await getI18n();
  return (
    <>
      <PageHeader title={m.contacts.newTitle} />
      <Card><ContactForm /></Card>
    </>
  );
}
