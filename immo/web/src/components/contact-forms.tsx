"use client";

import { useActionState } from "react";
import { CONTACT_KINDS, CURRENCIES, DEAL_TYPES, PROPERTY_TYPES } from "@immo/core";
import { saveBuyerRequest, saveContact } from "@/app/actions/contacts";
import { CONTACT_KIND_LABELS, DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { Alert, Button, Field, Input, LinkButton, Select, Textarea } from "./ui";

export function ContactForm() {
  const [state, action, pending] = useActionState(saveContact, undefined);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="fullName" error={e.fullName}>
          <Input name="fullName" defaultValue={v.fullName} required maxLength={120} error={e.fullName} />
        </Field>
        <Field label="Art" name="kind" error={e.kind}>
          <Select name="kind" defaultValue={v.kind ?? "buyer"}>
            {CONTACT_KINDS.map((o) => <option key={o} value={o}>{CONTACT_KIND_LABELS[o]}</option>)}
          </Select>
        </Field>
        <Field label="Telefon" name="phone" error={e.phone}>
          <Input name="phone" defaultValue={v.phone} type="tel" autoComplete="off" maxLength={40} error={e.phone} />
        </Field>
        <Field label="E-Mail" name="email" error={e.email}>
          <Input name="email" defaultValue={v.email} type="email" autoComplete="off" maxLength={200} error={e.email} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notizen" name="notes" error={e.notes}>
            <Textarea name="notes" defaultValue={v.notes} rows={4} maxLength={5000} error={e.notes} />
          </Field>
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Speichern…" : "Speichern"}</Button>
        <LinkButton href="/app/contacts" variant="secondary">Abbrechen</LinkButton>
      </div>
    </form>
  );
}

export function BuyerRequestForm({ contactId }: { contactId: string }) {
  const [state, action, pending] = useActionState(saveBuyerRequest.bind(null, contactId), undefined);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  const checkedTypes = state?.values ? (v.propertyTypes ?? "").split(",") : ["apartment"];
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.notice ? <Alert tone="brand">{state.notice}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vermarktung" name="dealType" error={e.dealType}>
          <Select name="dealType" defaultValue={v.dealType ?? "sale"}>
            {DEAL_TYPES.map((o) => <option key={o} value={o}>{DEAL_TYPE_LABELS[o]}</option>)}
          </Select>
        </Field>
        <Field label="Währung" name="currency" error={e.currency}>
          <Select name="currency" defaultValue={v.currency ?? "EUR"}>
            {CURRENCIES.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Objektarten</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {PROPERTY_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="propertyTypes" value={type} defaultChecked={checkedTypes.includes(type)} className="size-4 accent-brand" />
                {PROPERTY_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
          {e.propertyTypes ? <p className="mt-1 text-xs text-danger">{e.propertyTypes}</p> : null}
        </fieldset>
        <Field label="Stadt" name="city" error={e.city}>
          <Input name="city" defaultValue={v.city} required maxLength={80} error={e.city} />
        </Field>
        <Field label="Stadtteile" name="districts" error={e.districts} hint="Mehrere mit Komma trennen, leer = alle">
          <Input name="districts" defaultValue={v.districts} error={e.districts} />
        </Field>
        <Field label="Preis von" name="minPrice" error={e.minPrice}>
          <Input name="minPrice" defaultValue={v.minPrice} type="number" inputMode="numeric" min={0} step={1} error={e.minPrice} />
        </Field>
        <Field label="Preis bis" name="maxPrice" error={e.maxPrice}>
          <Input name="maxPrice" defaultValue={v.maxPrice} type="number" inputMode="numeric" min={1} step={1} error={e.maxPrice} />
        </Field>
        <Field label="Fläche von (m²)" name="minAreaSqm" error={e.minAreaSqm}>
          <Input name="minAreaSqm" defaultValue={v.minAreaSqm} type="number" inputMode="decimal" min={1} step="0.1" error={e.minAreaSqm} />
        </Field>
        <Field label="Fläche bis (m²)" name="maxAreaSqm" error={e.maxAreaSqm}>
          <Input name="maxAreaSqm" defaultValue={v.maxAreaSqm} type="number" inputMode="decimal" min={1} step="0.1" error={e.maxAreaSqm} />
        </Field>
        <Field label="Zimmer ab" name="minRooms" error={e.minRooms}>
          <Input name="minRooms" defaultValue={v.minRooms} type="number" inputMode="decimal" min={0} step="0.5" error={e.minRooms} />
        </Field>
      </div>
      <div><Button type="submit" disabled={pending}>{pending ? "Speichern…" : "Suchauftrag anlegen"}</Button></div>
    </form>
  );
}
