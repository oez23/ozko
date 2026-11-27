"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { getContact } from "@/lib/data/contacts";
import { dismissMatch, markMatchesSeen } from "@/lib/data/matching";
import { createShare, revokeShare } from "@/lib/data/shares";
import { NotFoundError } from "@/lib/errors";
import { MAX_PRESENTATION_ITEMS } from "@/lib/pdf/limits";

const pairSchema = z.object({ requestId: z.uuid(), propertyId: z.uuid() });

export async function dismiss(requestId: string, propertyId: string): Promise<void> {
  const session = await requireSession();
  const pair = pairSchema.parse({ requestId, propertyId });
  await dismissMatch(session, pair.requestId, pair.propertyId);
  revalidatePath("/app", "layout");
}

export async function markSeen(): Promise<void> {
  await markMatchesSeen(await requireSession());
  revalidatePath("/app", "layout");
}

/** APP_URL wins when set: a Host header is client-controlled and must not end up in links sent to customers. */
async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export type ShareState = { error?: string; url?: string; whatsapp?: string } | undefined;

const shareSchema = z.object({ contactId: z.uuid(), propertyIds: z.array(z.uuid()).min(1).max(MAX_PRESENTATION_ITEMS) });

export async function createShareLink(contactId: string, propertyIds: string[]): Promise<ShareState> {
  const session = await requireSession();
  const { m } = await getI18n();
  const parsed = shareSchema.safeParse({ contactId, propertyIds });
  if (!parsed.success) return { error: m.errors.invalid };
  try {
    const token = await createShare(session, parsed.data.contactId, parsed.data.propertyIds);
    const contact = await getContact(session, parsed.data.contactId);
    const url = `${await baseUrl()}/p/${token}`;
    const digits = contact.phone?.replace(/\D/g, "") ?? "";
    revalidatePath(`/app/contacts/${contactId}`);
    return {
      url,
      whatsapp: digits.length >= 10 ? `https://wa.me/${digits}?text=${encodeURIComponent(fill(m.share.message, { url }))}` : undefined,
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { error: m.contacts.notFound };
    throw error;
  }
}

export async function revokeShareLink(shareId: string): Promise<void> {
  const session = await requireSession();
  const contactId = await revokeShare(session, z.uuid().parse(shareId));
  if (contactId) revalidatePath(`/app/contacts/${contactId}`);
}
