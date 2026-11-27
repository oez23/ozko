import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { LocaleSwitch } from "@/components/locale-switch";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.auth.login };
}

export default async function Page() {
  if (await getSession()) redirect("/app");
  const { m, locale } = await getI18n();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-lg font-semibold text-brand">{m.brand}</p>
        <LocaleSwitch current={locale} />
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{m.auth.login}</h1>
      <LoginForm />
    </main>
  );
}
