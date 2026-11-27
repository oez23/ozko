import type { z } from "zod";
import { fill, type Messages } from "@/i18n";

export type FormState =
  | { error?: string; fieldErrors?: Record<string, string>; notice?: string; values?: Record<string, string> }
  | undefined;

/** Turns a validation issue into a sentence in the user's language; the schemas themselves carry no prose. */
export function issueMessage(issue: z.core.$ZodIssue, m: Messages): string {
  const e = m.errors;
  switch (issue.code) {
    case "too_small":
      if (issue.origin === "string") return issue.minimum <= 1 ? e.required : fill(e.tooShort, { min: Number(issue.minimum) });
      if (issue.origin === "array") return e.selectOne;
      if (issue.minimum === 0 && !issue.inclusive) return e.positive;
      return fill(e.tooSmall, { min: Number(issue.minimum) });
    case "too_big":
      return issue.origin === "string"
        ? fill(e.tooLong, { max: Number(issue.maximum) })
        : fill(e.tooBig, { max: Number(issue.maximum) });
    case "invalid_format":
      return issue.format === "email" ? e.invalidEmail : e.invalid;
    case "invalid_type":
      if (issue.expected === "int") return e.notInteger;
      // Issues carry no input value by default; zod's own message is the only sign that the field was absent.
      return issue.message.endsWith("received undefined") ? e.required : e.invalid;
    case "custom":
      return issue.message in e ? e[issue.message as keyof typeof e] : e.invalid;
    default:
      return e.invalid;
  }
}

/** First message per field, keyed by the form field name. */
export function fieldErrors(error: z.ZodError, m: Messages): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in out)) out[key] = issueMessage(issue, m);
  }
  return out;
}

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

export function invalidForm(error: z.ZodError, formData: FormData, m: Messages): NonNullable<FormState> {
  return { error: m.errors.invalidForm, fieldErrors: fieldErrors(error, m), values: submittedValues(formData) };
}
