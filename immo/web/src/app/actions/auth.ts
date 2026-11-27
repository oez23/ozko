"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { credentialsSchema, profileSchema, registrationSchema } from "@immo/core";
import { db } from "@/db/client";
import { memberships, organizations, users } from "@/db/schema";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import { getI18n } from "@/i18n/server";
import {
  authenticate, createSession, destroySession, hashPassword, requireSession, setSessionCookie,
} from "@/lib/auth";
import { updateProfile } from "@/lib/data/team";
import { invalidForm, submittedValues, type FormState } from "@/lib/form";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const { m } = await getI18n();
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  // Never reveal whether the e-mail or the password was wrong.
  if (!parsed.success) return { error: m.auth.invalid, values: submittedValues(formData) };
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return { error: result.reason === "locked" ? m.auth.locked : m.auth.invalid, values: submittedValues(formData) };
  }
  const { token, expiresAt } = await createSession(result.userId, result.orgId);
  await setSessionCookie(token, expiresAt);
  redirect("/app");
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const { m } = await getI18n();
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData, m);
  const { email, password, fullName, phone, organizationName } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: m.auth.registrationFailed, values: submittedValues(formData) };

  const passwordHash = await hashPassword(password);
  const { userId, orgId } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: organizationName }).returning({ id: organizations.id });
    const [user] = await tx
      .insert(users)
      .values({ email, fullName, phone: phone ?? null, passwordHash })
      .returning({ id: users.id });
    await tx.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: "owner" });
    return { userId: user!.id, orgId: org!.id };
  });
  const { token, expiresAt } = await createSession(userId, orgId);
  await setSessionCookie(token, expiresAt);
  redirect("/app");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function saveProfile(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const { m } = await getI18n();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData, m);
  await updateProfile(session, parsed.data);
  revalidatePath("/app", "layout");
  return { notice: m.settings.saved };
}

/** The locale is a display preference, not an account setting, so it also works before login. */
export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  }
  revalidatePath("/", "layout");
}
