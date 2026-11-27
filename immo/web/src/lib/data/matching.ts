import "server-only";
import { cache } from "react";
import { and, eq, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { canAccessContact, canSeeAllContacts, PRICE_TOLERANCE, rankMatches, scoreMatch, type MatchResult } from "@immo/core";
import { db } from "@/db/client";
import { buyerRequests, contacts, matchDismissals, organizations, properties, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";
import { NotFoundError } from "@/lib/errors";
import { getContact, type BuyerRequest } from "./contacts";
import type { Property } from "./properties";

/** Upper bound on candidates scored in memory; the SQL prefilter (deal type, city, …) keeps this small in practice. */
const CANDIDATE_LIMIT = 500;

/**
 * The only property columns that may ever leave an office: what a customer would see in a listing.
 * The street address, the owner, the mandate end and the internal agent id are deliberately absent.
 * Network queries select exactly this object, so nothing else can leak through a careless spread.
 */
export const PUBLIC_PROPERTY_COLUMNS = {
  id: properties.id,
  title: properties.title,
  dealType: properties.dealType,
  propertyType: properties.propertyType,
  status: properties.status,
  price: properties.price,
  currency: properties.currency,
  city: properties.city,
  district: properties.district,
  areaSqm: properties.areaSqm,
  rooms: properties.rooms,
  livingRooms: properties.livingRooms,
  bathrooms: properties.bathrooms,
  floor: properties.floor,
  yearBuilt: properties.yearBuilt,
  description: properties.description,
};
export type PublicProperty = Pick<Property, keyof typeof PUBLIC_PROPERTY_COLUMNS>;

/** Who to call at the other office. Never a customer. */
export type NetworkParty = { orgName: string; agentName: string; agentPhone: string | null };

const PARTY_COLUMNS = { orgName: organizations.name, agentName: users.fullName, agentPhone: users.phone };

/** A listing from another office is visible only while it is active and its agent opted in. */
const isNetworkListing = (session: Session): SQL =>
  and(ne(properties.orgId, session.orgId), eq(properties.sharedWithNetwork, true), eq(properties.status, "active"))!;

export type RequestMatch = {
  requestId: string;
  agentName: string;
  /** Null when the buyer belongs to a colleague or another office: a match exists, the customer stays private. */
  contact: { id: string; fullName: string } | null;
  network: NetworkParty | null;
  match: MatchResult;
};

/**
 * Buyers for one of the office's own listings. Requests from other offices are included only when
 * both sides opted in: this listing is shared and so is the request.
 */
export async function matchRequestsForProperty(session: Session, property: Property): Promise<RequestMatch[]> {
  const candidates = await db
    .select({ request: buyerRequests, contactName: contacts.fullName, ...PARTY_COLUMNS })
    .from(buyerRequests)
    .innerJoin(contacts, eq(contacts.id, buyerRequests.contactId))
    .innerJoin(users, eq(users.id, buyerRequests.agentId))
    .innerJoin(organizations, eq(organizations.id, buyerRequests.orgId))
    .where(
      and(
        eq(buyerRequests.active, true),
        eq(buyerRequests.dealType, property.dealType),
        eq(buyerRequests.cityKey, property.cityKey),
        or(
          eq(buyerRequests.orgId, session.orgId),
          property.sharedWithNetwork ? eq(buyerRequests.sharedWithNetwork, true) : sql`false`,
        ),
      ),
    )
    .limit(CANDIDATE_LIMIT);
  return rankMatches(candidates, (c) => scoreMatch(property, c.request)).map(({ item, match }) => {
    const sameOffice = item.request.orgId === session.orgId;
    return {
      requestId: item.request.id,
      agentName: item.agentName,
      contact:
        sameOffice && canAccessContact(session, item.request.agentId)
          ? { id: item.request.contactId, fullName: item.contactName }
          : null,
      network: sameOffice ? null : { orgName: item.orgName, agentName: item.agentName, agentPhone: item.agentPhone },
      match,
    };
  });
}

export type PropertyMatch = { property: PublicProperty; network: NetworkParty | null; match: MatchResult };

/** Listings for a buyer request: the office's own active listings plus other offices' shared ones. */
export async function matchPropertiesForRequest(session: Session, request: BuyerRequest): Promise<PropertyMatch[]> {
  if (!request.active) return [];
  const candidates = await db
    .select({ property: PUBLIC_PROPERTY_COLUMNS, orgId: properties.orgId, ...PARTY_COLUMNS })
    .from(properties)
    .innerJoin(users, eq(users.id, properties.agentId))
    .innerJoin(organizations, eq(organizations.id, properties.orgId))
    .leftJoin(
      matchDismissals,
      and(eq(matchDismissals.propertyId, properties.id), eq(matchDismissals.requestId, request.id)),
    )
    .where(
      and(
        isNull(matchDismissals.requestId),
        eq(properties.dealType, request.dealType),
        eq(properties.cityKey, request.cityKey),
        or(and(eq(properties.orgId, session.orgId), eq(properties.status, "active")), isNetworkListing(session)),
      ),
    )
    .limit(CANDIDATE_LIMIT);
  return rankMatches(candidates, (c) => scoreMatch(c.property, request)).map(({ item, match }) => ({
    property: item.property,
    network:
      item.orgId === session.orgId ? null : { orgName: item.orgName, agentName: item.agentName, agentPhone: item.agentPhone },
    match,
  }));
}

export type InboxMatch = PropertyMatch & {
  requestId: string;
  contact: { id: string; fullName: string };
  isNew: boolean;
};

/**
 * Every current match for the buyers this user may see, newest first. A match counts as new when the
 * listing changed or the request was created after the user last cleared the inbox.
 * Memoised per request because the navigation badge and the inbox page both need it.
 */
export const listMatchInbox = cache(async (session: Session): Promise<InboxMatch[]> => {
  const [seen] = await db.select({ at: users.matchesSeenAt }).from(users).where(eq(users.id, session.userId)).limit(1);
  const seenAt = seen?.at ?? new Date(0);

  const where: SQL[] = [eq(buyerRequests.orgId, session.orgId), eq(buyerRequests.active, true), isNull(matchDismissals.requestId)];
  if (!canSeeAllContacts(session)) where.push(eq(buyerRequests.agentId, session.userId));

  const rows = await db
    .select({
      request: buyerRequests,
      contactName: contacts.fullName,
      property: PUBLIC_PROPERTY_COLUMNS,
      propertyOrgId: properties.orgId,
      propertyUpdatedAt: properties.updatedAt,
      ...PARTY_COLUMNS,
    })
    .from(buyerRequests)
    .innerJoin(contacts, eq(contacts.id, buyerRequests.contactId))
    // Hard criteria in SQL so the join stays index-driven; the score is computed in scoreMatch().
    .innerJoin(
      properties,
      and(
        eq(properties.dealType, buyerRequests.dealType),
        eq(properties.cityKey, buyerRequests.cityKey),
        eq(properties.currency, buyerRequests.currency),
        sql`${properties.propertyType} = any(${buyerRequests.propertyTypes})`,
        sql`(${buyerRequests.maxPrice} is null or ${properties.price} <= ${buyerRequests.maxPrice} * ${1 + PRICE_TOLERANCE}::numeric)`,
        or(and(eq(properties.orgId, session.orgId), eq(properties.status, "active")), isNetworkListing(session)),
      ),
    )
    .innerJoin(users, eq(users.id, properties.agentId))
    .innerJoin(organizations, eq(organizations.id, properties.orgId))
    .leftJoin(
      matchDismissals,
      and(eq(matchDismissals.propertyId, properties.id), eq(matchDismissals.requestId, buyerRequests.id)),
    )
    .where(and(...where))
    .limit(CANDIDATE_LIMIT * 4);

  return rankMatches(rows, (row) => scoreMatch(row.property, row.request))
    .map(({ item, match }) => ({
      requestId: item.request.id,
      contact: { id: item.request.contactId, fullName: item.contactName },
      property: item.property,
      network:
        item.propertyOrgId === session.orgId
          ? null
          : { orgName: item.orgName, agentName: item.agentName, agentPhone: item.agentPhone },
      match,
      isNew: Math.max(item.propertyUpdatedAt.getTime(), item.request.createdAt.getTime()) > seenAt.getTime(),
    }))
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.match.score - a.match.score);
});

export async function markMatchesSeen(session: Session): Promise<void> {
  await db.update(users).set({ matchesSeenAt: new Date() }).where(eq(users.id, session.userId));
}

/** Only someone who may see the buyer can rule a listing out for them. */
export async function dismissMatch(session: Session, requestId: string, propertyId: string): Promise<void> {
  const [request] = await db
    .select({ contactId: buyerRequests.contactId })
    .from(buyerRequests)
    .where(and(eq(buyerRequests.id, requestId), eq(buyerRequests.orgId, session.orgId)))
    .limit(1);
  if (!request) throw new NotFoundError();
  await getContact(session, request.contactId);
  await db.insert(matchDismissals).values({ requestId, propertyId, userId: session.userId }).onConflictDoNothing();
  await audit(session, "dismiss", "match", requestId, { propertyId });
}

/** A listing of another office, as far as it is shared. Own listings are served by getProperty(). */
export async function getNetworkProperty(session: Session, id: string): Promise<{ property: PublicProperty; party: NetworkParty }> {
  const [row] = await db
    .select({ property: PUBLIC_PROPERTY_COLUMNS, ...PARTY_COLUMNS })
    .from(properties)
    .innerJoin(users, eq(users.id, properties.agentId))
    .innerJoin(organizations, eq(organizations.id, properties.orgId))
    .where(and(eq(properties.id, id), isNetworkListing(session)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return { property: row.property, party: { orgName: row.orgName, agentName: row.agentName, agentPhone: row.agentPhone } };
}
