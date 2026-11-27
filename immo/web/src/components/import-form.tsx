"use client";

import { useActionState } from "react";
import { importCsv } from "@/app/actions/properties";
import { Alert, Button, Field } from "./ui";

export function ImportForm() {
  const [state, action, pending] = useActionState(importCsv, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.notice ? <Alert tone="brand">{state.notice}</Alert> : null}
      <Field label="CSV-Datei" name="file" hint="Maximal 2 MB und 2000 Zeilen, Trennzeichen Komma oder Semikolon">
        <input id="file" name="file" type="file" accept=".csv,text/csv" required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-strong" />
      </Field>
      <div><Button type="submit" disabled={pending}>{pending ? "Importiere…" : "Importieren"}</Button></div>
    </form>
  );
}
