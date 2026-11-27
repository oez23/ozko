import "server-only";
import { and, eq } from "drizzle-orm";
import { canAccessContact, rankMatches, scoreMatch, type MatchResult } from "@immo/core";
import { db } from "@/db/client";
import { buyerRequests, contacts, properties, users } from "@/db/schema";
import type { Session } from "@/lib/auth";
import type { BuyerRequest } from "./contacts";
import type { Property } from "./properties";

/** Upper bound on candidates scored in memory; the SQL prefilter (office, deal type, city) keeps this small in practice. */
const CANDIDATE_LIMIT = 500;

export type RequestMatch = {
  requestId: string;
  agentName: string;
  /** Null when the buyer belongs to a colleague: the agent learns that a match exists, not who the customer is. */
  contact: { id: string; fullName: string } | null;
  match: MatchResult;
};

export async function matchRequestsForProperty(session: Session, property: Property): Promise<RequestMatch[]> {
  const candidates = await db
    .select({ request: buyerRequests, contactName: contacts.fullName, agentName: users.fullName })
    .from(buyerRequests)
    .innerJoin(contacts, eq(contacts.id, buyerRequests.contactId))
    .innerJoin(users, eq(users.id, buyerRequests.agentId))
    .where(
      and(
        eq(buyerRequests.orgId, session.orgId),
        eq(buyerRequests.active, true),
        eq(buyerRequests.dealType, property.dealType),
        eq(buyerRequests.cityKey, property.cityKey),
      ),
    )
    .limit(CANDIDATE_LIMIT);
  return rankMatches(candidates, (c) => scoreMatch(property, c.request)).map(({ item, match }) => ({
    requestId: item.request.id,
    agentName: item.agentName,
    contact: canAccessContact(session, item.request.agentId)
      ? { id: item.request.contactId, fullName: item.contactName }
      : null,
    match,
  }));
}

export type PropertyMatch = { property: Property; match: MatchResult };

export async function matchPropertiesForRequest(session: Session, request: BuyerRequest): Promise<PropertyMatch[]> {
  if (!request.active) return [];
  const candidates = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.orgId, session.orgId),
        eq(properties.status, "active"),
        eq(properties.dealType, request.dealType),
        eq(properties.cityKey, request.cityKey),
      ),
    )
    .limit(CANDIDATE_LIMIT);
  return rankMatches(candidates, (p) => scoreMatch(p, request)).map(({ item, match }) => ({ property: item, match }));
}
