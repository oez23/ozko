import "server-only";
import { and, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import {
  canEditProperty, estimateValue, placeKey, type DealType, type PropertyInput, type PropertyStatus,
  type PropertyType, type Valuation,
} from "@immo/core";
import { db } from "@/db/client";
import { contacts, priceHistory, properties, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const PAGE_SIZE = 25;

export type Property = typeof properties.$inferSelect;

export type PropertyFilters = {
  q?: string;
  dealType?: DealType;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  mine?: boolean;
  page?: number;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

export async function listProperties(session: Session, filters: PropertyFilters) {
  const where: SQL[] = [eq(properties.orgId, session.orgId)];
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    where.push(or(ilike(properties.title, pattern), ilike(properties.district, pattern), ilike(properties.address, pattern))!);
  }
  if (filters.dealType) where.push(eq(properties.dealType, filters.dealType));
  if (filters.propertyType) where.push(eq(properties.propertyType, filters.propertyType));
  if (filters.status) where.push(eq(properties.status, filters.status));
  if (filters.city) where.push(eq(properties.cityKey, placeKey(filters.city)));
  if (filters.minPrice !== undefined) where.push(gte(properties.price, filters.minPrice));
  if (filters.maxPrice !== undefined) where.push(lte(properties.price, filters.maxPrice));
  if (filters.mine) where.push(eq(properties.agentId, session.userId));

  const page = Math.max(1, filters.page ?? 1);
  const [rows, [total]] = await Promise.all([
    db
      .select({ property: properties, agentName: users.fullName })
      .from(properties)
      .innerJoin(users, eq(users.id, properties.agentId))
      .where(and(...where))
      .orderBy(desc(properties.createdAt), desc(properties.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(properties).where(and(...where)),
  ]);
  const count = total?.count ?? 0;
  return { rows, total: count, page, pages: Math.max(1, Math.ceil(count / PAGE_SIZE)) };
}

export async function getProperty(session: Session, id: string) {
  const [row] = await db
    .select({ property: properties, agentName: users.fullName })
    .from(properties)
    .innerJoin(users, eq(users.id, properties.agentId))
    .where(and(eq(properties.id, id), eq(properties.orgId, session.orgId)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return { ...row, canEdit: canEditProperty(session, row.property.agentId) };
}

/** An owner contact must belong to this office and be visible to the acting user. */
async function assertOwnerContact(session: Session, contactId: string | undefined): Promise<void> {
  if (!contactId) return;
  const [contact] = await db
    .select({ agentId: contacts.agentId })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, session.orgId)))
    .limit(1);
  if (!contact) throw new NotFoundError();
  if (session.role === "agent" && contact.agentId !== session.userId) throw new ForbiddenError();
}

const toRow = (input: PropertyInput) => ({
  ...input,
  cityKey: placeKey(input.city),
  district: input.district ?? null,
  address: input.address ?? null,
  areaSqm: input.areaSqm ?? null,
  rooms: input.rooms ?? null,
  bathrooms: input.bathrooms ?? null,
  floor: input.floor ?? null,
  yearBuilt: input.yearBuilt ?? null,
  description: input.description ?? null,
  ownerContactId: input.ownerContactId ?? null,
  mandateEndsOn: input.mandateEndsOn ?? null,
});

export async function createProperty(session: Session, input: PropertyInput): Promise<string> {
  await assertOwnerContact(session, input.ownerContactId);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(properties)
      .values({ ...toRow(input), orgId: session.orgId, agentId: session.userId })
      .returning({ id: properties.id });
    const id = created!.id;
    await tx.insert(priceHistory).values({ orgId: session.orgId, propertyId: id, price: input.price, status: input.status });
    await audit(session, "create", "property", id, undefined, tx);
    return id;
  });
}

export async function updateProperty(session: Session, id: string, input: PropertyInput): Promise<void> {
  const { property } = await getProperty(session, id);
  if (!canEditProperty(session, property.agentId)) throw new ForbiddenError();
  await assertOwnerContact(session, input.ownerContactId);
  await db.transaction(async (tx) => {
    await tx
      .update(properties)
      .set({ ...toRow(input), updatedAt: new Date() })
      .where(and(eq(properties.id, id), eq(properties.orgId, session.orgId)));
    if (property.price !== input.price || property.status !== input.status) {
      await tx.insert(priceHistory).values({ orgId: session.orgId, propertyId: id, price: input.price, status: input.status });
    }
    await audit(session, "update", "property", id, { price: input.price, status: input.status }, tx);
  });
}

export async function importProperties(session: Session, inputs: PropertyInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(properties)
      .values(inputs.map((input) => ({ ...toRow(input), ownerContactId: null, orgId: session.orgId, agentId: session.userId })))
      .returning({ id: properties.id, price: properties.price, status: properties.status });
    await tx
      .insert(priceHistory)
      .values(created.map((p) => ({ orgId: session.orgId, propertyId: p.id, price: p.price, status: p.status })));
    await audit(session, "import", "property", null, { count: created.length }, tx);
    return created.length;
  });
}

export async function getPriceHistory(session: Session, propertyId: string) {
  return db
    .select({ price: priceHistory.price, status: priceHistory.status, createdAt: priceHistory.createdAt })
    .from(priceHistory)
    .where(and(eq(priceHistory.propertyId, propertyId), eq(priceHistory.orgId, session.orgId)))
    .orderBy(desc(priceHistory.createdAt));
}

/** Valuation from the office's own listings only: same deal type, property type, city and currency. */
export async function valueProperty(session: Session, property: Property): Promise<Valuation> {
  const comparables = await db
    .select({ id: properties.id, price: properties.price, areaSqm: properties.areaSqm })
    .from(properties)
    .where(
      and(
        eq(properties.orgId, session.orgId),
        ne(properties.id, property.id),
        eq(properties.dealType, property.dealType),
        eq(properties.propertyType, property.propertyType),
        eq(properties.cityKey, property.cityKey),
        eq(properties.currency, property.currency),
        inArray(properties.status, ["active", "reserved", "closed"]),
        isNotNull(properties.areaSqm),
      ),
    )
    .limit(500);
  return estimateValue(
    property.areaSqm,
    comparables.map((c) => ({ id: c.id, price: c.price, areaSqm: c.areaSqm! })),
  );
}

export async function listExpiringMandates(session: Session, withinDays: number) {
  const until = new Date(Date.now() + withinDays * 86_400_000).toISOString().slice(0, 10);
  const where: SQL[] = [
    eq(properties.orgId, session.orgId),
    inArray(properties.status, ["active", "reserved"]),
    isNotNull(properties.mandateEndsOn),
    lte(properties.mandateEndsOn, until),
  ];
  if (session.role === "agent") where.push(eq(properties.agentId, session.userId));
  return db
    .select({ id: properties.id, title: properties.title, mandateEndsOn: properties.mandateEndsOn })
    .from(properties)
    .where(and(...where))
    .orderBy(properties.mandateEndsOn)
    .limit(10);
}

export async function countByStatus(session: Session) {
  return db
    .select({ status: properties.status, count: sql<number>`count(*)::int` })
    .from(properties)
    .where(eq(properties.orgId, session.orgId))
    .groupBy(properties.status);
}
