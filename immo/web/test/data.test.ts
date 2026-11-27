import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { PropertyInput, Role } from "@immo/core";
import { db, pool } from "@/db/client";
import { auditLog, buyerRequests, memberships, organizations, users } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { createBuyerRequest, createContact, getContact, listContacts, setBuyerRequestActive } from "@/lib/data/contacts";
import { matchPropertiesForRequest, matchRequestsForProperty } from "@/lib/data/matching";
import {
  createProperty, getPriceHistory, getProperty, importProperties, listProperties, updateProperty, valueProperty,
} from "@/lib/data/properties";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

let seq = 0;
async function member(orgId: string, orgName: string, role: Role): Promise<Session> {
  const email = `user${++seq}@test.invalid`;
  const [user] = await db.insert(users).values({ email, fullName: `User ${seq}`, passwordHash: "x" }).returning();
  await db.insert(memberships).values({ orgId, userId: user!.id, role });
  return { userId: user!.id, orgId, role, fullName: user!.fullName, email, orgName };
}
async function org(name: string) {
  const [created] = await db.insert(organizations).values({ name }).returning();
  return created!.id;
}

const flat = (patch: Partial<PropertyInput> = {}): PropertyInput => ({
  title: "Wohnung am Park", dealType: "sale", propertyType: "apartment", status: "active",
  price: 300_000, currency: "EUR", city: "Berlin", district: "Mitte", areaSqm: 100, rooms: 3, ...patch,
});

let owner: Session, agentA: Session, agentB: Session, outsider: Session;

beforeAll(async () => {
  await db.execute(sql`truncate organizations, users cascade`);
  const acme = await org("Acme Immobilien");
  owner = await member(acme, "Acme Immobilien", "owner");
  agentA = await member(acme, "Acme Immobilien", "agent");
  agentB = await member(acme, "Acme Immobilien", "agent");
  outsider = await member(await org("Rival GmbH"), "Rival GmbH", "owner");
});

afterAll(() => pool.end());

describe("tenant isolation", () => {
  it("never returns or changes another office's property", async () => {
    const id = await createProperty(agentA, flat());
    expect((await listProperties(outsider, {})).total).toBe(0);
    await expect(getProperty(outsider, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProperty(outsider, id, flat({ price: 1 }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(getPriceHistory(outsider, id)).resolves.toEqual([]);
    expect((await getProperty(agentA, id)).property.price).toBe(300_000);
  });

  it("never returns another office's contact and refuses it as property owner", async () => {
    const contactId = await createContact(agentA, { fullName: "Erika Muster", kind: "seller" });
    await expect(getContact(outsider, contactId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createProperty(outsider, flat({ ownerContactId: contactId }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createBuyerRequest(outsider, {
        contactId, dealType: "sale", propertyTypes: ["apartment"], city: "Berlin", districts: [], currency: "EUR",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("roles inside one office", () => {
  it("lets colleagues read a property but only the responsible agent or a manager edit it", async () => {
    const id = await createProperty(agentA, flat({ title: "Nur A darf ändern" }));
    expect((await getProperty(agentB, id)).canEdit).toBe(false);
    await expect(updateProperty(agentB, id, flat({ price: 1 }))).rejects.toBeInstanceOf(ForbiddenError);
    await updateProperty(owner, id, flat({ title: "Nur A darf ändern", price: 290_000 }));
    expect((await getProperty(agentA, id)).property.price).toBe(290_000);
  });

  it("hides an agent's contacts from other agents but not from managers", async () => {
    const contactId = await createContact(agentA, { fullName: "Geheimer Kunde", kind: "buyer" });
    await expect(getContact(agentB, contactId)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listContacts(agentB)).map((r) => r.contact.id)).not.toContain(contactId);
    expect((await listContacts(owner)).map((r) => r.contact.id)).toContain(contactId);
    await expect(createProperty(agentB, flat({ ownerContactId: contactId }))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("price history and audit", () => {
  it("records a history entry only when price or status changes", async () => {
    const id = await createProperty(agentA, flat({ title: "Verlauf" }));
    await updateProperty(agentA, id, flat({ title: "Verlauf, neuer Titel" }));
    await updateProperty(agentA, id, flat({ title: "Verlauf", price: 280_000 }));
    await updateProperty(agentA, id, flat({ title: "Verlauf", price: 280_000, status: "reserved" }));
    const history = await getPriceHistory(agentA, id);
    expect(history.map((h) => [h.price, h.status])).toEqual([
      [280_000, "reserved"], [280_000, "active"], [300_000, "active"],
    ]);
    const entries = await db.select().from(auditLog).where(sql`${auditLog.entityId} = ${id}`);
    expect(entries.map((e) => e.action).sort()).toEqual(["create", "update", "update", "update"]);
  });
});

describe("matching", () => {
  it("matches both directions and hides a colleague's customer identity", async () => {
    const propertyId = await createProperty(agentB, flat({ title: "Match-Objekt", city: "İzmir", district: "Karşıyaka" }));
    const contactId = await createContact(agentA, { fullName: "Ayşe Yılmaz", kind: "buyer" });
    const requestId = await createBuyerRequest(agentA, {
      contactId, dealType: "sale", propertyTypes: ["apartment"], city: "izmir", districts: ["Karsiyaka"],
      currency: "EUR", maxPrice: 320_000, minRooms: 3,
    });
    const { property } = await getProperty(agentB, propertyId);

    const seenByColleague = await matchRequestsForProperty(agentB, property);
    expect(seenByColleague).toHaveLength(1);
    expect(seenByColleague[0]).toMatchObject({ requestId, contact: null, match: { score: 100 } });
    expect(JSON.stringify(seenByColleague)).not.toContain("Ayşe");

    expect((await matchRequestsForProperty(agentA, property))[0]?.contact).toEqual({ id: contactId, fullName: "Ayşe Yılmaz" });
    expect(await matchRequestsForProperty(outsider, property)).toEqual([]);

    await setBuyerRequestActive(agentA, requestId, false);
    expect(await matchRequestsForProperty(agentA, property)).toEqual([]);
    await expect(setBuyerRequestActive(agentB, requestId, true)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("finds properties for a request only inside the same office", async () => {
    await createProperty(outsider, flat({ title: "Fremdes Objekt", city: "Hamburg" }));
    const ownId = await createProperty(agentA, flat({ title: "Eigenes Objekt", city: "Hamburg" }));
    const contactId = await createContact(agentA, { fullName: "Hans Hamburg", kind: "buyer" });
    const requestId = await createBuyerRequest(agentA, {
      contactId, dealType: "sale", propertyTypes: ["apartment"], city: "Hamburg", districts: [], currency: "EUR",
    });
    const [request] = await db.select().from(buyerRequests).where(eq(buyerRequests.id, requestId));
    expect((await matchPropertiesForRequest(agentA, request!)).map((m) => m.property.id)).toEqual([ownId]);
  });
});

describe("import, filters and valuation", () => {
  it("imports rows atomically and filters by normalised city, price and search text", async () => {
    const count = await importProperties(agentA, [
      flat({ title: "Köln 1", city: "Köln", price: 200_000, areaSqm: 100 }),
      flat({ title: "Köln 2", city: "Köln", price: 240_000, areaSqm: 100 }),
      flat({ title: "Köln 3 100%_Lage", city: "Köln", price: 280_000, areaSqm: 100 }),
    ]);
    expect(count).toBe(3);
    expect((await listProperties(agentA, { city: "KOLN" })).total).toBe(3);
    expect((await listProperties(agentA, { city: "koln", minPrice: 210_000, maxPrice: 250_000 })).rows.map((r) => r.property.title)).toEqual(["Köln 2"]);
    // % and _ are literal characters in a search, not wildcards.
    expect((await listProperties(agentA, { q: "100%_" })).total).toBe(1);
    expect((await listProperties(agentA, { q: "%" })).total).toBe(1);
    expect((await listProperties(outsider, { city: "Köln" })).total).toBe(0);
  });

  it("values a property from the office's own comparables and refuses when there are too few", async () => {
    const subjectId = await createProperty(agentA, flat({ title: "Köln Subjekt", city: "Köln", price: 999_999, areaSqm: 110 }));
    const valuation = await valueProperty(agentA, (await getProperty(agentA, subjectId)).property);
    expect(valuation).toMatchObject({ ok: true, comparablesUsed: 3, estimate: { mid: 264_000 } });

    const loneId = await createProperty(agentA, flat({ title: "Einzelstück", city: "Bonn" }));
    expect(await valueProperty(agentA, (await getProperty(agentA, loneId)).property)).toMatchObject({
      ok: false, reason: "insufficient_comparables",
    });
  });
});
