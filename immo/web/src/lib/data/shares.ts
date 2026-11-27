import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { canAccessContact } from "@immo/core";
import { db } from "@/db/client";
import { organizations, properties, shares, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";
import { NotFoundError } from "@/lib/errors";
import { MAX_PRESENTATION_ITEMS } from "@/lib/pdf/limits";
import { getContact } from "./contacts";
import { PUBLIC_PROPERTY_COLUMNS, type PublicProperty } from "./matching";

const SHARE_DAYS = 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Creates a public link to some of the office's own listings for one customer. The raw token is
 * returned once and never stored, so a database leak does not expose working links.
 */
export async function createShare(session: Session, contactId: string, propertyIds: string[]): Promise<string> {
  const contact = await getContact(session, contactId);
  const own = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.orgId, session.orgId), inArray(properties.id, propertyIds.slice(0, MAX_PRESENTATION_ITEMS))));
  const allowed = new Set(own.map((p) => p.id));
  const ids = propertyIds.filter((id) => allowed.has(id));
  if (ids.length === 0) throw new NotFoundError();

  const token = randomBytes(32).toString("base64url");
  const [created] = await db
    .insert(shares)
    .values({
      orgId: session.orgId,
      agentId: session.userId,
      contactId: contact.id,
      tokenHash: hashToken(token),
      propertyIds: ids,
      expiresAt: new Date(Date.now() + SHARE_DAYS * 86_400_000),
    })
    .returning({ id: shares.id });
  await audit(session, "create", "share", created!.id, { contactId, properties: ids });
  return token;
}

export async function listSharesForContact(session: Session, contactId: string) {
  await getContact(session, contactId);
  return db
    .select({
      id: shares.id, createdAt: shares.createdAt, expiresAt: shares.expiresAt, viewCount: shares.viewCount,
      lastViewedAt: shares.lastViewedAt, count: sql<number>`cardinality(${shares.propertyIds})`,
    })
    .from(shares)
    .where(and(eq(shares.orgId, session.orgId), eq(shares.contactId, contactId)))
    .orderBy(desc(shares.createdAt))
    .limit(20);
}

/** Revoking deletes the row, so the link stops working at once. */
export async function revokeShare(session: Session, shareId: string): Promise<string | null> {
  const [share] = await db
    .select({ agentId: shares.agentId, contactId: shares.contactId })
    .from(shares)
    .where(and(eq(shares.id, shareId), eq(shares.orgId, session.orgId)))
    .limit(1);
  if (!share || !canAccessContact(session, share.agentId)) throw new NotFoundError();
  await db.delete(shares).where(and(eq(shares.id, shareId), eq(shares.orgId, session.orgId)));
  await audit(session, "revoke", "share", shareId);
  return share.contactId;
}

export type PublicShare = {
  orgName: string;
  agent: { fullName: string; phone: string | null; email: string };
  properties: PublicProperty[];
};

/**
 * Resolves a public link without any session. Returns customer-safe listing facts and the agent's
 * business contact only; the customer's identity is never part of the page. Listings that were
 * withdrawn or closed since the link was sent disappear from it.
 */
export async function resolveShare(token: string): Promise<PublicShare | null> {
  if (token.length < 20 || token.length > 100) return null;
  const [share] = await db
    .update(shares)
    .set({ viewCount: sql`${shares.viewCount} + 1`, lastViewedAt: new Date() })
    .where(and(eq(shares.tokenHash, hashToken(token)), gt(shares.expiresAt, new Date())))
    .returning({ orgId: shares.orgId, agentId: shares.agentId, propertyIds: shares.propertyIds });
  if (!share) return null;

  const [[party], rows] = await Promise.all([
    db
      .select({ orgName: organizations.name, fullName: users.fullName, phone: users.phone, email: users.email })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, share.orgId))
      .where(eq(users.id, share.agentId))
      .limit(1),
    db
      .select(PUBLIC_PROPERTY_COLUMNS)
      .from(properties)
      .where(
        and(
          eq(properties.orgId, share.orgId),
          inArray(properties.id, share.propertyIds),
          inArray(properties.status, ["active", "reserved"]),
        ),
      ),
  ]);
  if (!party) return null;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    orgName: party.orgName,
    agent: { fullName: party.fullName, phone: party.phone, email: party.email },
    properties: share.propertyIds.flatMap((id) => byId.get(id) ?? []),
  };
}
