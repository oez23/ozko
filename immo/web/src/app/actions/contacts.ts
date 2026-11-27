"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buyerRequestInputSchema, contactInputSchema } from "@immo/core";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { createBuyerRequest, createContact, setBuyerRequestActive } from "@/lib/data/contacts";
import { NotFoundError } from "@/lib/errors";
import { invalidForm, submittedValues, type FormState } from "@/lib/form";

export async function saveContact(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const { m } = await getI18n();
  const parsed = contactInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData, m);
  const id = await createContact(session, parsed.data);
  revalidatePath("/app/contacts");
  redirect(`/app/contacts/${id}`);
}

export async function saveBuyerRequest(contactId: string, _: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const { m } = await getI18n();
  const parsed = buyerRequestInputSchema.safeParse({
    ...Object.fromEntries(formData),
    contactId,
    propertyTypes: formData.getAll("propertyTypes"),
    districts: String(formData.get("districts") ?? "").split(",").map((d) => d.trim()).filter(Boolean),
  });
  if (!parsed.success) return invalidForm(parsed.error, formData, m);
  try {
    await createBuyerRequest(session, parsed.data);
  } catch (error) {
    if (error instanceof NotFoundError) return { error: m.contacts.notFound, values: submittedValues(formData) };
    throw error;
  }
  revalidatePath(`/app/contacts/${contactId}`);
  return { notice: m.request.saved };
}

export async function toggleBuyerRequest(requestId: string, active: boolean): Promise<void> {
  const session = await requireSession();
  const contactId = await setBuyerRequestActive(session, requestId, active);
  revalidatePath(`/app/contacts/${contactId}`);
}
