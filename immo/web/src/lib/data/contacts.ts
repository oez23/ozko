import "server-only";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { canAccessContact, canSeeAllContacts, placeKey, type BuyerRequestInput, type ContactInput } from "@immo/core";
import { db } from "@/db/client";
import { buyerRequests, contacts, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";
import { NotFoundError } from "@/lib/errors";

export type Contact = typeof contacts.$inferSelect;
export type BuyerRequest = typeof buyerRequests.$inferSelect;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Agents are scoped to their own contacts in SQL, not filtered afterwards. */
function visibleContacts(session: Session): SQL[] {
  const where: SQL[] = [eq(contacts.orgId, session.orgId)];
  if (!canSeeAllContacts(session)) where.push(eq(contacts.agentId, session.userId));
  return where;
}

export async function listContacts(session: Session, q?: string) {
  const where = visibleContacts(session);
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    where.push(or(ilike(contacts.fullName, pattern), ilike(contacts.email, pattern), ilike(contacts.phone, pattern))!);
  }
  return db
    .select({
      contact: contacts,
      agentName: users.fullName,
      requestCount: sql<number>`(select count(*)::int from ${buyerRequests} br where br.contact_id = ${contacts.id} and br.active)`,
    })
    .from(contacts)
    .innerJoin(users, eq(users.id, contacts.agentId))
    .where(and(...where))
    .orderBy(desc(contacts.createdAt))
    .limit(200);
}

export async function getContact(session: Session, id: string): Promise<Contact> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, session.orgId)))
    .limit(1);
  // An inaccessible contact looks the same as a missing one, so ids cannot be probed.
  if (!contact || !canAccessContact(session, contact.agentId)) throw new NotFoundError();
  return contact;
}

export async function createContact(session: Session, input: ContactInput): Promise<string> {
  const [created] = await db
    .insert(contacts)
    .values({
      orgId: session.orgId,
      agentId: session.userId,
      fullName: input.fullName,
      kind: input.kind,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
    })
    .returning({ id: contacts.id });
  await audit(session, "create", "contact", created!.id);
  return created!.id;
}

export async function listRequestsForContact(session: Session, contactId: string): Promise<BuyerRequest[]> {
  await getContact(session, contactId);
  return db
    .select()
    .from(buyerRequests)
    .where(and(eq(buyerRequests.contactId, contactId), eq(buyerRequests.orgId, session.orgId)))
    .orderBy(desc(buyerRequests.createdAt));
}

export async function createBuyerRequest(session: Session, input: BuyerRequestInput): Promise<string> {
  const contact = await getContact(session, input.contactId);
  const [created] = await db
    .insert(buyerRequests)
    .values({
      orgId: session.orgId,
      agentId: contact.agentId,
      contactId: contact.id,
      dealType: input.dealType,
      propertyTypes: input.propertyTypes,
      city: input.city,
      cityKey: placeKey(input.city),
      districts: input.districts,
      currency: input.currency,
      minPrice: input.minPrice ?? null,
      maxPrice: input.maxPrice ?? null,
      minAreaSqm: input.minAreaSqm ?? null,
      maxAreaSqm: input.maxAreaSqm ?? null,
      minRooms: input.minRooms ?? null,
      notes: input.notes ?? null,
      sharedWithNetwork: input.sharedWithNetwork,
    })
    .returning({ id: buyerRequests.id });
  await audit(session, "create", "buyer_request", created!.id);
  return created!.id;
}

export async function setBuyerRequestActive(session: Session, requestId: string, active: boolean): Promise<string> {
  const [request] = await db
    .select({ contactId: buyerRequests.contactId })
    .from(buyerRequests)
    .where(and(eq(buyerRequests.id, requestId), eq(buyerRequests.orgId, session.orgId)))
    .limit(1);
  if (!request) throw new NotFoundError();
  await getContact(session, request.contactId);
  await db
    .update(buyerRequests)
    .set({ active })
    .where(and(eq(buyerRequests.id, requestId), eq(buyerRequests.orgId, session.orgId)));
  await audit(session, active ? "activate" : "deactivate", "buyer_request", requestId);
  return request.contactId;
}
