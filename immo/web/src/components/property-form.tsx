"use client";

import { useActionState } from "react";
import { CURRENCY_CHOICES, DEAL_TYPES, DEFAULT_CURRENCY, PROPERTY_STATUSES, PROPERTY_TYPES } from "@immo/core";
import { saveProperty } from "@/app/actions/properties";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Field, Input, LinkButton, Select, Textarea } from "./ui";

export type PropertyFormValues = Partial<Record<
  "title" | "dealType" | "propertyType" | "status" | "price" | "currency" | "city" | "district" | "address" |
  "areaSqm" | "rooms" | "livingRooms" | "bathrooms" | "floor" | "yearBuilt" | "description" | "ownerContactId" |
  "mandateEndsOn" | "sharedWithNetwork",
  string
>>;

export function PropertyForm({ id, values: initial = {}, contacts }: {
  id: string | null;
  values?: PropertyFormValues;
  contacts: { id: string; fullName: string }[];
}) {
  const { m } = useI18n();
  const p = m.property;
  const [state, action, pending] = useActionState(saveProperty.bind(null, id), undefined);
  const e = state?.fieldErrors ?? {};
  const values: PropertyFormValues = state?.values ?? initial;
  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={p.title} name="title" error={e.title}>
            <Input name="title" defaultValue={values.title} required maxLength={160} error={e.title} />
          </Field>
        </div>
        <Field label={p.dealType} name="dealType" error={e.dealType}>
          <Select name="dealType" defaultValue={values.dealType ?? "sale"} error={e.dealType}>
            {DEAL_TYPES.map((v) => <option key={v} value={v}>{m.enums.dealType[v]}</option>)}
          </Select>
        </Field>
        <Field label={p.propertyType} name="propertyType" error={e.propertyType}>
          <Select name="propertyType" defaultValue={values.propertyType ?? "apartment"} error={e.propertyType}>
            {PROPERTY_TYPES.map((v) => <option key={v} value={v}>{m.enums.propertyType[v]}</option>)}
          </Select>
        </Field>
        <Field label={p.price} name="price" error={e.price}>
          <Input name="price" type="number" inputMode="numeric" min={1} step={1} defaultValue={values.price} required error={e.price} />
        </Field>
        <Field label={p.currency} name="currency" error={e.currency}>
          <Select name="currency" defaultValue={values.currency ?? DEFAULT_CURRENCY} error={e.currency}>
            {CURRENCY_CHOICES.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </Field>
        <Field label={p.status} name="status" error={e.status}>
          <Select name="status" defaultValue={values.status ?? "active"} error={e.status}>
            {PROPERTY_STATUSES.map((v) => <option key={v} value={v}>{m.enums.status[v]}</option>)}
          </Select>
        </Field>
        <Field label={p.mandateEndsOn} name="mandateEndsOn" error={e.mandateEndsOn}>
          <Input name="mandateEndsOn" type="date" defaultValue={values.mandateEndsOn} error={e.mandateEndsOn} />
        </Field>
        <Field label={p.city} name="city" error={e.city}>
          <Input name="city" defaultValue={values.city} required maxLength={80} error={e.city} />
        </Field>
        <Field label={p.district} name="district" error={e.district}>
          <Input name="district" defaultValue={values.district} maxLength={80} error={e.district} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={p.address} name="address" error={e.address} hint={p.addressHint}>
            <Input name="address" defaultValue={values.address} maxLength={240} error={e.address} />
          </Field>
        </div>
        <Field label={p.areaSqm} name="areaSqm" error={e.areaSqm}>
          <Input name="areaSqm" type="number" inputMode="decimal" min={1} step="0.1" defaultValue={values.areaSqm} error={e.areaSqm} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={p.rooms} name="rooms" error={e.rooms}>
            <Input name="rooms" type="number" inputMode="decimal" min={0} step="0.5" defaultValue={values.rooms} error={e.rooms} />
          </Field>
          <Field label={p.livingRooms} name="livingRooms" error={e.livingRooms}>
            <Input name="livingRooms" type="number" inputMode="numeric" min={0} max={10} step={1} defaultValue={values.livingRooms} error={e.livingRooms} />
          </Field>
        </div>
        <Field label={p.bathrooms} name="bathrooms" error={e.bathrooms}>
          <Input name="bathrooms" type="number" inputMode="numeric" min={0} step={1} defaultValue={values.bathrooms} error={e.bathrooms} />
        </Field>
        <Field label={p.floor} name="floor" error={e.floor}>
          <Input name="floor" type="number" inputMode="numeric" step={1} defaultValue={values.floor} error={e.floor} />
        </Field>
        <Field label={p.yearBuilt} name="yearBuilt" error={e.yearBuilt}>
          <Input name="yearBuilt" type="number" inputMode="numeric" step={1} defaultValue={values.yearBuilt} error={e.yearBuilt} />
        </Field>
        <Field label={p.ownerContact} name="ownerContactId" error={e.ownerContactId}>
          <Select name="ownerContactId" defaultValue={values.ownerContactId ?? ""} error={e.ownerContactId}>
            <option value="">{p.noContact}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={p.description} name="description" error={e.description}>
            <Textarea name="description" rows={6} defaultValue={values.description} maxLength={5000} error={e.description} />
          </Field>
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-line bg-canvas p-4 text-sm">
        <input type="checkbox" name="sharedWithNetwork" className="mt-0.5 size-4 accent-brand"
          defaultChecked={values.sharedWithNetwork === "true" || values.sharedWithNetwork === "on"} />
        <span>
          <span className="font-medium">{m.network.shareProperty}</span>
          <span className="mt-1 block text-xs text-muted">{m.network.sharePropertyHint}</span>
        </span>
      </label>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? m.common.saving : m.common.save}</Button>
        <LinkButton href={id ? `/app/portfolio/${id}` : "/app/portfolio"} variant="secondary">{m.common.cancel}</LinkButton>
      </div>
    </form>
  );
}
