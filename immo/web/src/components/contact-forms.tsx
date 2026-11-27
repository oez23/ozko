"use client";

import { useActionState } from "react";
import { CONTACT_KINDS, CURRENCY_CHOICES, DEAL_TYPES, DEFAULT_CURRENCY, PROPERTY_TYPES } from "@immo/core";
import { saveBuyerRequest, saveContact } from "@/app/actions/contacts";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Field, Input, LinkButton, Select, Textarea } from "./ui";

export function ContactForm() {
  const { m } = useI18n();
  const c = m.contacts;
  const [state, action, pending] = useActionState(saveContact, undefined);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.fullName} name="fullName" error={e.fullName}>
          <Input name="fullName" defaultValue={v.fullName} required maxLength={120} error={e.fullName} />
        </Field>
        <Field label={c.kind} name="kind" error={e.kind}>
          <Select name="kind" defaultValue={v.kind ?? "buyer"}>
            {CONTACT_KINDS.map((o) => <option key={o} value={o}>{m.enums.contactKind[o]}</option>)}
          </Select>
        </Field>
        <Field label={c.phone} name="phone" error={e.phone}>
          <Input name="phone" defaultValue={v.phone} type="tel" autoComplete="off" maxLength={40} error={e.phone} />
        </Field>
        <Field label={c.email} name="email" error={e.email}>
          <Input name="email" defaultValue={v.email} type="email" autoComplete="off" maxLength={200} error={e.email} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={c.notes} name="notes" error={e.notes}>
            <Textarea name="notes" defaultValue={v.notes} rows={4} maxLength={5000} error={e.notes} />
          </Field>
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? m.common.saving : m.common.save}</Button>
        <LinkButton href="/app/contacts" variant="secondary">{m.common.cancel}</LinkButton>
      </div>
    </form>
  );
}

export function BuyerRequestForm({ contactId }: { contactId: string }) {
  const { m } = useI18n();
  const r = m.request;
  const [state, action, pending] = useActionState(saveBuyerRequest.bind(null, contactId), undefined);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  const checkedTypes = state?.values ? (v.propertyTypes ?? "").split(",") : ["apartment"];
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.notice ? <Alert tone="brand">{state.notice}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={m.property.dealType} name="dealType" error={e.dealType}>
          <Select name="dealType" defaultValue={v.dealType ?? "sale"}>
            {DEAL_TYPES.map((o) => <option key={o} value={o}>{m.enums.dealType[o]}</option>)}
          </Select>
        </Field>
        <Field label={m.property.currency} name="currency" error={e.currency}>
          <Select name="currency" defaultValue={v.currency ?? DEFAULT_CURRENCY}>
            {CURRENCY_CHOICES.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">{r.propertyTypes}</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {PROPERTY_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="propertyTypes" value={type} defaultChecked={checkedTypes.includes(type)} className="size-4 accent-brand" />
                {m.enums.propertyType[type]}
              </label>
            ))}
          </div>
          {e.propertyTypes ? <p className="mt-1 text-xs text-danger">{e.propertyTypes}</p> : null}
        </fieldset>
        <Field label={m.property.city} name="city" error={e.city}>
          <Input name="city" defaultValue={v.city} required maxLength={80} error={e.city} />
        </Field>
        <Field label={r.districts} name="districts" error={e.districts} hint={r.districtsHint}>
          <Input name="districts" defaultValue={v.districts} error={e.districts} />
        </Field>
        <Field label={r.priceFrom} name="minPrice" error={e.minPrice}>
          <Input name="minPrice" defaultValue={v.minPrice} type="number" inputMode="numeric" min={0} step={1} error={e.minPrice} />
        </Field>
        <Field label={r.priceTo} name="maxPrice" error={e.maxPrice}>
          <Input name="maxPrice" defaultValue={v.maxPrice} type="number" inputMode="numeric" min={1} step={1} error={e.maxPrice} />
        </Field>
        <Field label={r.areaFrom} name="minAreaSqm" error={e.minAreaSqm}>
          <Input name="minAreaSqm" defaultValue={v.minAreaSqm} type="number" inputMode="decimal" min={1} step="0.1" error={e.minAreaSqm} />
        </Field>
        <Field label={r.areaTo} name="maxAreaSqm" error={e.maxAreaSqm}>
          <Input name="maxAreaSqm" defaultValue={v.maxAreaSqm} type="number" inputMode="decimal" min={1} step="0.1" error={e.maxAreaSqm} />
        </Field>
        <Field label={r.minRooms} name="minRooms" error={e.minRooms}>
          <Input name="minRooms" defaultValue={v.minRooms} type="number" inputMode="decimal" min={0} step="0.5" error={e.minRooms} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="sharedWithNetwork" defaultChecked={v.sharedWithNetwork === "on"} className="mt-0.5 size-4 accent-brand" />
        <span>
          <span className="font-medium">{m.network.shareRequest}</span>
          <span className="mt-1 block text-xs text-muted">{m.network.shareRequestHint}</span>
        </span>
      </label>
      <div><Button type="submit" disabled={pending}>{pending ? m.common.saving : r.submit}</Button></div>
    </form>
  );
}
