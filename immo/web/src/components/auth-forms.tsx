"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "./ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field label="E-Mail" name="email">
        <Input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Passwort" name="password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Anmelden…" : "Anmelden"}</Button>
      <p className="text-center text-sm text-muted">
        Noch kein Konto? <Link href="/register" className="font-medium text-brand underline">Büro registrieren</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const errors = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field label="Name des Büros" name="organizationName" error={errors.organizationName}>
        <Input name="organizationName" autoComplete="organization" required defaultValue={v.organizationName} error={errors.organizationName} />
      </Field>
      <Field label="Ihr Name" name="fullName" error={errors.fullName}>
        <Input name="fullName" autoComplete="name" required defaultValue={v.fullName} error={errors.fullName} />
      </Field>
      <Field label="E-Mail" name="email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" required defaultValue={v.email} error={errors.email} />
      </Field>
      <Field label="Passwort" name="password" error={errors.password} hint="Mindestens 10 Zeichen">
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} error={errors.password} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Wird angelegt…" : "Büro anlegen"}</Button>
      <p className="text-center text-sm text-muted">
        Schon registriert? <Link href="/login" className="font-medium text-brand underline">Anmelden</Link>
      </p>
    </form>
  );
}
