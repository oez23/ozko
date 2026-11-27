"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { credentialsSchema, registrationSchema } from "@immo/core";
import { db } from "@/db/client";
import { memberships, organizations, users } from "@/db/schema";
import { authenticate, createSession, destroySession, hashPassword, setSessionCookie } from "@/lib/auth";
import { fieldErrors, INVALID_FORM, submittedValues, type FormState } from "@/lib/form";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  // Never reveal whether the e-mail or the password was wrong.
  if (!parsed.success) return { error: "E-Mail oder Passwort ist falsch.", values: submittedValues(formData) };
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return {
      error: result.reason === "locked"
        ? "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen."
        : "E-Mail oder Passwort ist falsch.",
      values: submittedValues(formData),
    };
  }
  const { token, expiresAt } = await createSession(result.userId, result.orgId);
  await setSessionCookie(token, expiresAt);
  redirect("/app");
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: INVALID_FORM, fieldErrors: fieldErrors(parsed.error), values: submittedValues(formData) };
  const { email, password, fullName, organizationName } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return {
      error: "Registrierung nicht möglich. Bitte anmelden oder eine andere E-Mail verwenden.",
      values: submittedValues(formData),
    };
  }

  const passwordHash = await hashPassword(password);
  const { userId, orgId } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: organizationName }).returning({ id: organizations.id });
    const [user] = await tx.insert(users).values({ email, fullName, passwordHash }).returning({ id: users.id });
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
