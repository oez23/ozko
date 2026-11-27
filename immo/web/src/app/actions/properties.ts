"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_IMPORT_ROWS, parsePropertyCsv, propertyInputSchema, type ImportError } from "@immo/core";
import { fill, type Messages } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { createProperty, importProperties, updateProperty } from "@/lib/data/properties";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { invalidForm, issueMessage, submittedValues, type FormState } from "@/lib/form";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function saveProperty(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const { m } = await getI18n();
  const parsed = propertyInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData, m);

  let targetId = id;
  try {
    if (id) await updateProperty(session, id, parsed.data);
    else targetId = await createProperty(session, parsed.data);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: m.property.forbidden, values: submittedValues(formData) };
    if (error instanceof NotFoundError) return { error: m.property.notFound, values: submittedValues(formData) };
    throw error;
  }
  revalidatePath("/app/portfolio");
  redirect(`/app/portfolio/${targetId}`);
}

/** Column keys are internal names; the user sees the same labels as on the property form. */
function columnLabel(column: string, m: Messages): string {
  const labels = m.property as Record<string, string>;
  return labels[column] ?? column;
}

function describeImportError(error: ImportError, m: Messages): string {
  switch (error.code) {
    case "empty_file":
      return m.import.error.empty_file;
    case "too_many_rows":
      return fill(m.import.error.too_many_rows, { max: MAX_IMPORT_ROWS });
    case "missing_columns":
      return fill(m.import.error.missing_columns, { columns: error.columns.map((c) => columnLabel(c, m)).join(", ") });
    case "invalid_row":
      return `${fill(m.import.line, { line: error.line })}, ${columnLabel(error.field, m)}: ${issueMessage(error.issue, m)}`;
  }
}

export async function importCsv(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const { m } = await getI18n();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: m.import.chooseFile };
  if (file.size > MAX_CSV_BYTES) return { error: m.import.tooLarge };

  const result = parsePropertyCsv(await file.text());
  // All-or-nothing: a half-imported file is harder to repair than a rejected one.
  if (result.errors.length > 0) {
    const shown = result.errors.slice(0, 10).map((error) => describeImportError(error, m));
    const rest = result.errors.length - shown.length;
    const more = rest > 0 ? ` ${fill(m.import.andMore, { count: rest })}` : "";
    return { error: `${m.import.nothingImported} ${shown.join(" · ")}${more}` };
  }
  if (result.rows.length === 0) return { error: m.import.noRows };

  const count = await importProperties(session, result.rows);
  revalidatePath("/app/portfolio");
  const ignored =
    result.unknownColumns.length > 0 ? ` ${fill(m.import.ignoredColumns, { columns: result.unknownColumns.join(", ") })}` : "";
  return { notice: `${fill(m.import.done, { count })}${ignored}` };
}
