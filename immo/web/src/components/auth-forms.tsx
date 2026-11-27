"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MIN_PASSWORD_LENGTH } from "@immo/core";
import { login, register, saveProfile } from "@/app/actions/auth";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Field, Input } from "./ui";

export function LoginForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field label={m.auth.email} name="email">
        <Input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label={m.auth.password} name="password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? m.auth.loggingIn : m.auth.login}</Button>
      <p className="text-center text-sm text-muted">
        {m.auth.noAccount} <Link href="/register" className="font-medium text-brand underline">{m.auth.register}</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(register, undefined);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field label={m.auth.officeName} name="organizationName" error={e.organizationName}>
        <Input name="organizationName" autoComplete="organization" required defaultValue={v.organizationName} error={e.organizationName} />
      </Field>
      <Field label={m.auth.yourName} name="fullName" error={e.fullName}>
        <Input name="fullName" autoComplete="name" required defaultValue={v.fullName} error={e.fullName} />
      </Field>
      <Field label={m.auth.phone} name="phone" error={e.phone} hint={m.auth.phoneHint}>
        <Input name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone} />
      </Field>
      <Field label={m.auth.email} name="email" error={e.email}>
        <Input name="email" type="email" autoComplete="email" required defaultValue={v.email} error={e.email} />
      </Field>
      <Field label={m.auth.password} name="password" error={e.password} hint={fill(m.auth.passwordHint, { min: MIN_PASSWORD_LENGTH })}>
        <Input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} error={e.password} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? m.auth.registering : m.auth.createOffice}</Button>
      <p className="text-center text-sm text-muted">
        {m.auth.haveAccount} <Link href="/login" className="font-medium text-brand underline">{m.auth.login}</Link>
      </p>
    </form>
  );
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string | null }) {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? { fullName, phone: phone ?? "" };
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.notice ? <Alert tone="brand">{state.notice}</Alert> : null}
      <Field label={m.auth.yourName} name="fullName" error={e.fullName}>
        <Input name="fullName" autoComplete="name" required defaultValue={v.fullName} error={e.fullName} />
      </Field>
      <Field label={m.auth.phone} name="phone" error={e.phone} hint={m.auth.phoneHint}>
        <Input name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone} />
      </Field>
      <div><Button type="submit" disabled={pending}>{pending ? m.common.saving : m.common.save}</Button></div>
    </form>
  );
}
