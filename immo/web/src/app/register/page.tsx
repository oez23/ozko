import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Büro registrieren" };

export default async function Page() {
  if (await getSession()) redirect("/app");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <p className="mb-6 text-lg font-semibold text-brand">Ozko Immo</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Büro registrieren</h1>
      <RegisterForm />
    </main>
  );
}
