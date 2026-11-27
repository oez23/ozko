import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-forms";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kontakt anlegen" };

export default async function NewContactPage() {
  await requireSession();
  return (
    <>
      <PageHeader title="Kontakt anlegen" />
      <Card><ContactForm /></Card>
    </>
  );
}
