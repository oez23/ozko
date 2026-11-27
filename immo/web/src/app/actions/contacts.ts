"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buyerRequestInputSchema, contactInputSchema } from "@immo/core";
import { requireSession } from "@/lib/auth";
import { createBuyerRequest, createContact, setBuyerRequestActive } from "@/lib/data/contacts";
import { NotFoundError } from "@/lib/errors";
import { fieldErrors, INVALID_FORM, submittedValues, type FormState } from "@/lib/form";

export async function saveContact(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = contactInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: INVALID_FORM, fieldErrors: fieldErrors(parsed.error), values: submittedValues(formData) };
  const id = await createContact(session, parsed.data);
  revalidatePath("/app/contacts");
  redirect(`/app/contacts/${id}`);
}

export async function saveBuyerRequest(contactId: string, _: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = buyerRequestInputSchema.safeParse({
    ...Object.fromEntries(formData),
    contactId,
    propertyTypes: formData.getAll("propertyTypes"),
    districts: String(formData.get("districts") ?? "").split(",").map((d) => d.trim()).filter(Boolean),
  });
  if (!parsed.success) return { error: INVALID_FORM, fieldErrors: fieldErrors(parsed.error), values: submittedValues(formData) };
  try {
    await createBuyerRequest(session, parsed.data);
  } catch (error) {
    if (error instanceof NotFoundError) return { error: "Kontakt nicht gefunden." };
    throw error;
  }
  revalidatePath(`/app/contacts/${contactId}`);
  return { notice: "Suchauftrag gespeichert." };
}

export async function toggleBuyerRequest(requestId: string, active: boolean): Promise<void> {
  const session = await requireSession();
  const contactId = await setBuyerRequestActive(session, requestId, active);
  revalidatePath(`/app/contacts/${contactId}`);
}
