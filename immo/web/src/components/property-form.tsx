"use client";

import { useActionState } from "react";
import { CURRENCIES, DEAL_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES } from "@immo/core";
import { saveProperty } from "@/app/actions/properties";
import { DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { Alert, Button, Field, Input, LinkButton, Select, Textarea } from "./ui";

export type PropertyFormValues = Partial<Record<
  "title" | "dealType" | "propertyType" | "status" | "price" | "currency" | "city" | "district" | "address" |
  "areaSqm" | "rooms" | "bathrooms" | "floor" | "yearBuilt" | "description" | "ownerContactId" | "mandateEndsOn",
  string
>>;

export function PropertyForm({ id, values: initial = {}, contacts }: {
  id: string | null;
  values?: PropertyFormValues;
  contacts: { id: string; fullName: string }[];
}) {
  const [state, action, pending] = useActionState(saveProperty.bind(null, id), undefined);
  const e = state?.fieldErrors ?? {};
  const values: PropertyFormValues = state?.values ?? initial;
  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Titel" name="title" error={e.title}>
            <Input name="title" defaultValue={values.title} required maxLength={160} error={e.title} />
          </Field>
        </div>
        <Field label="Vermarktung" name="dealType" error={e.dealType}>
          <Select name="dealType" defaultValue={values.dealType ?? "sale"} error={e.dealType}>
            {DEAL_TYPES.map((v) => <option key={v} value={v}>{DEAL_TYPE_LABELS[v]}</option>)}
          </Select>
        </Field>
        <Field label="Objektart" name="propertyType" error={e.propertyType}>
          <Select name="propertyType" defaultValue={values.propertyType ?? "apartment"} error={e.propertyType}>
            {PROPERTY_TYPES.map((v) => <option key={v} value={v}>{PROPERTY_TYPE_LABELS[v]}</option>)}
          </Select>
        </Field>
        <Field label="Preis" name="price" error={e.price}>
          <Input name="price" type="number" inputMode="numeric" min={1} step={1} defaultValue={values.price} required error={e.price} />
        </Field>
        <Field label="Währung" name="currency" error={e.currency}>
          <Select name="currency" defaultValue={values.currency ?? "EUR"} error={e.currency}>
            {CURRENCIES.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Status" name="status" error={e.status}>
          <Select name="status" defaultValue={values.status ?? "active"} error={e.status}>
            {PROPERTY_STATUSES.map((v) => <option key={v} value={v}>{STATUS_LABELS[v]}</option>)}
          </Select>
        </Field>
        <Field label="Auftrag endet am" name="mandateEndsOn" error={e.mandateEndsOn}>
          <Input name="mandateEndsOn" type="date" defaultValue={values.mandateEndsOn} error={e.mandateEndsOn} />
        </Field>
        <Field label="Stadt" name="city" error={e.city}>
          <Input name="city" defaultValue={values.city} required maxLength={80} error={e.city} />
        </Field>
        <Field label="Stadtteil" name="district" error={e.district}>
          <Input name="district" defaultValue={values.district} maxLength={80} error={e.district} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Adresse" name="address" error={e.address} hint="Nur intern sichtbar">
            <Input name="address" defaultValue={values.address} maxLength={240} error={e.address} />
          </Field>
        </div>
        <Field label="Fläche (m²)" name="areaSqm" error={e.areaSqm}>
          <Input name="areaSqm" type="number" inputMode="decimal" min={1} step="0.1" defaultValue={values.areaSqm} error={e.areaSqm} />
        </Field>
        <Field label="Zimmer" name="rooms" error={e.rooms}>
          <Input name="rooms" type="number" inputMode="decimal" min={0} step="0.5" defaultValue={values.rooms} error={e.rooms} />
        </Field>
        <Field label="Bäder" name="bathrooms" error={e.bathrooms}>
          <Input name="bathrooms" type="number" inputMode="numeric" min={0} step={1} defaultValue={values.bathrooms} error={e.bathrooms} />
        </Field>
        <Field label="Etage" name="floor" error={e.floor}>
          <Input name="floor" type="number" inputMode="numeric" step={1} defaultValue={values.floor} error={e.floor} />
        </Field>
        <Field label="Baujahr" name="yearBuilt" error={e.yearBuilt}>
          <Input name="yearBuilt" type="number" inputMode="numeric" step={1} defaultValue={values.yearBuilt} error={e.yearBuilt} />
        </Field>
        <Field label="Eigentümer (Kontakt)" name="ownerContactId" error={e.ownerContactId}>
          <Select name="ownerContactId" defaultValue={values.ownerContactId ?? ""} error={e.ownerContactId}>
            <option value="">– kein Kontakt –</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Beschreibung" name="description" error={e.description}>
            <Textarea name="description" rows={6} defaultValue={values.description} maxLength={5000} error={e.description} />
          </Field>
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Speichern…" : "Speichern"}</Button>
        <LinkButton href={id ? `/app/portfolio/${id}` : "/app/portfolio"} variant="secondary">Abbrechen</LinkButton>
      </div>
    </form>
  );
}
