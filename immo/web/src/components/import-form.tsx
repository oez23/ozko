"use client";

import { useActionState } from "react";
import { MAX_IMPORT_ROWS } from "@immo/core";
import { importCsv } from "@/app/actions/properties";
import { fill } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Field } from "./ui";

export function ImportForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(importCsv, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.notice ? <Alert tone="brand">{state.notice}</Alert> : null}
      <Field label={m.import.file} name="file" hint={fill(m.import.fileHint, { max: MAX_IMPORT_ROWS })}>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-strong" />
      </Field>
      <div><Button type="submit" disabled={pending}>{pending ? m.import.submitting : m.import.submit}</Button></div>
    </form>
  );
}
