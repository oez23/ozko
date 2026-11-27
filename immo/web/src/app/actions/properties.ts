"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_IMPORT_ROWS, parsePropertyCsv, propertyInputSchema } from "@immo/core";
import { requireSession } from "@/lib/auth";
import { createProperty, importProperties, updateProperty } from "@/lib/data/properties";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { fieldErrors, INVALID_FORM, submittedValues, type FormState } from "@/lib/form";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function saveProperty(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = propertyInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: INVALID_FORM, fieldErrors: fieldErrors(parsed.error), values: submittedValues(formData) };

  let targetId = id;
  try {
    if (id) await updateProperty(session, id, parsed.data);
    else targetId = await createProperty(session, parsed.data);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "Keine Berechtigung für dieses Objekt.", values: submittedValues(formData) };
    if (error instanceof NotFoundError) return { error: "Objekt oder Eigentümer-Kontakt nicht gefunden.", values: submittedValues(formData) };
    throw error;
  }
  revalidatePath("/app/portfolio");
  redirect(`/app/portfolio/${targetId}`);
}

export async function importCsv(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Bitte eine CSV-Datei auswählen." };
  if (file.size > MAX_CSV_BYTES) return { error: "Datei ist größer als 2 MB." };

  const result = parsePropertyCsv(await file.text());
  // All-or-nothing: a half-imported file is harder to repair than a rejected one.
  if (result.errors.length > 0) {
    const shown = result.errors.slice(0, 10).map((e) => `Zeile ${e.line}: ${e.message}`);
    const more = result.errors.length > shown.length ? ` … und ${result.errors.length - shown.length} weitere` : "";
    return { error: `Nichts importiert. ${shown.join(" · ")}${more}` };
  }
  if (result.rows.length === 0) return { error: `Keine Datenzeilen gefunden (maximal ${MAX_IMPORT_ROWS}).` };

  const count = await importProperties(session, result.rows);
  revalidatePath("/app/portfolio");
  const ignored = result.unknownColumns.length > 0 ? ` Ignorierte Spalten: ${result.unknownColumns.join(", ")}.` : "";
  return { notice: `${count} Objekte importiert.${ignored}` };
}
