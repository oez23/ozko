import type { Metadata } from "next";
import { ProfileForm } from "@/components/auth-forms";
import { LocaleSwitch } from "@/components/locale-switch";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.settings.title };
}

export default async function SettingsPage() {
  const session = await requireSession();
  const { m, locale } = await getI18n();
  return (
    <>
      <PageHeader title={m.settings.title} subtitle={session.email} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={m.settings.profile}><ProfileForm fullName={session.fullName} phone={session.phone} /></Card>
        <Card title={m.settings.language}>
          <p className="mb-3 text-sm text-muted">{m.settings.languageHint}</p>
          <LocaleSwitch current={locale} />
        </Card>
      </div>
    </>
  );
}
