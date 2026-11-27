import type { z } from "zod";

export type FormState =
  | { error?: string; fieldErrors?: Record<string, string>; notice?: string; values?: Record<string, string> }
  | undefined;

/**
 * React resets a form after its action runs, so a rejected submission must hand the
 * typed values back. Passwords and files are never echoed; repeated fields are comma-joined.
 */
export function submittedValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$") || key === "password") continue;
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    if (values.length > 0) out[key] = values.join(",");
  }
  return out;
}

/** First message per field, keyed by the form field name. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

export const INVALID_FORM = "Bitte die markierten Felder prüfen.";
