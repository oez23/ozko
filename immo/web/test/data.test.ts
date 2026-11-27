import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { BuyerRequestInput, PropertyInput, Role } from "@immo/core";
import { db, pool } from "@/db/client";
import { auditLog, buyerRequests, memberships, organizations, properties, shares, users } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { createBuyerRequest, createContact, getContact, listContacts, setBuyerRequestActive } from "@/lib/data/contacts";
import {
  dismissMatch, getNetworkProperty, listMatchInbox, markMatchesSeen, matchPropertiesForRequest, matchRequestsForProperty,
  PUBLIC_PROPERTY_COLUMNS,
} from "@/lib/data/matching";
import { createShare, listSharesForContact, resolveShare, revokeShare } from "@/lib/data/shares";
import {
  createProperty, getComparables, getPriceHistory, getPropertiesByIds, getProperty, importProperties, listProperties, updateProperty, valueProperty,
} from "@/lib/data/properties";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

let seq = 0;
async function member(orgId: string, orgName: string, role: Role): Promise<Session> {
  const email = `user${++seq}@test.invalid`;
  const [user] = await db.insert(users).values({ email, fullName: `User ${seq}`, passwordHash: "x" }).returning();
  await db.insert(memberships).values({ orgId, userId: user!.id, role });
  return { userId: user!.id, orgId, role, fullName: user!.fullName, email, phone: null, orgName };
}
async function org(name: string) {
  const [created] = await db.insert(organizations).values({ name }).returning();
  return created!.id;
}

const flat = (patch: Partial<PropertyInput> = {}): PropertyInput => ({
  title: "Wohnung am Park", dealType: "sale", propertyType: "apartment", status: "active",
  price: 300_000, currency: "EUR", city: "Berlin", district: "Mitte", areaSqm: 100, rooms: 3,
  sharedWithNetwork: false, ...patch,
});

const wish = (contactId: string, patch: Partial<BuyerRequestInput> = {}): BuyerRequestInput => ({
  contactId, dealType: "sale", propertyTypes: ["apartment"], city: "Berlin", districts: [], currency: "EUR",
  sharedWithNetwork: false, ...patch,
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
      createBuyerRequest(outsider, wish(contactId)),
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
    const requestId = await createBuyerRequest(
      agentA, wish(contactId, { city: "izmir", districts: ["Karsiyaka"], maxPrice: 320_000, minRooms: 3 }),
    );
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
    const requestId = await createBuyerRequest(agentA, wish(contactId, { city: "Hamburg" }));
    const [request] = await db.select().from(buyerRequests).where(eq(buyerRequests.id, requestId));
    expect((await matchPropertiesForRequest(agentA, request!)).map((m) => m.property.id)).toEqual([ownId]);
  });
});

const requestRow = async (id: string) => (await db.select().from(buyerRequests).where(eq(buyerRequests.id, id)))[0]!;
const SECRET = { address: "Gizli Sokak 7", mandateEndsOn: "2030-01-01" } as const;

describe("network matching across offices", () => {
  it("shows another office's listing only after an explicit opt-in, and then only its public facts", async () => {
    const ownerContact = await createContact(outsider, { fullName: "Mal Sahibi Mehmet", kind: "seller" });
    const input = flat({ title: "Rakip ofis dairesi", city: "Antalya", ownerContactId: ownerContact, ...SECRET });
    const propertyId = await createProperty(outsider, input);
    const contactId = await createContact(agentA, { fullName: "Antalya Alıcısı", kind: "buyer" });
    const request = await requestRow(await createBuyerRequest(agentA, wish(contactId, { city: "Antalya" })));

    expect(await matchPropertiesForRequest(agentA, request)).toEqual([]);
    await expect(getNetworkProperty(agentA, propertyId)).rejects.toBeInstanceOf(NotFoundError);

    await updateProperty(outsider, propertyId, { ...input, sharedWithNetwork: true });
    const [found] = await matchPropertiesForRequest(agentA, request);
    expect(found?.network).toEqual({ orgName: "Rival GmbH", agentName: outsider.fullName, agentPhone: null });
    expect(Object.keys(found!.property).sort()).toEqual(Object.keys(PUBLIC_PROPERTY_COLUMNS).sort());
    const leaked = JSON.stringify([found, await getNetworkProperty(agentA, propertyId), await listMatchInbox(agentA)]);
    for (const secret of ["Gizli Sokak", "2030-01-01", ownerContact, "Mal Sahibi", outsider.email, outsider.userId]) {
      expect(leaked).not.toContain(secret);
    }
    // The full record, and editing, stay with the owning office.
    await expect(getProperty(agentA, propertyId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProperty(agentA, propertyId, input)).rejects.toBeInstanceOf(NotFoundError);

    await updateProperty(outsider, propertyId, { ...input, sharedWithNetwork: true, status: "reserved" });
    expect(await matchPropertiesForRequest(agentA, request)).toEqual([]);
    await expect(getNetworkProperty(agentA, propertyId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("tells a listing's office that a foreign buyer exists only when both sides opted in, never who it is", async () => {
    const contactId = await createContact(outsider, { fullName: "Gizli Alıcı Zeynep", kind: "buyer", phone: "+90 555 000 11 22" });
    const privateId = await createProperty(agentA, flat({ title: "Paylaşılmayan", city: "Bursa" }));
    const sharedId = await createProperty(agentA, flat({ title: "Paylaşılan", city: "Bursa", sharedWithNetwork: true }));
    const shared = (await getProperty(agentA, sharedId)).property;
    const unshared = (await getProperty(agentA, privateId)).property;

    const hiddenRequest = await createBuyerRequest(outsider, wish(contactId, { city: "Bursa" }));
    expect(await matchRequestsForProperty(agentA, shared)).toEqual([]);

    const openRequest = await createBuyerRequest(outsider, wish(contactId, { city: "Bursa", sharedWithNetwork: true }));
    const matches = await matchRequestsForProperty(agentA, shared);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      requestId: openRequest, contact: null,
      network: { orgName: "Rival GmbH", agentName: outsider.fullName, agentPhone: null },
    });
    expect(JSON.stringify(matches)).not.toMatch(/Zeynep|555 000|Gizli/);
    // An unshared listing gets no foreign buyers even though the request is open.
    expect(await matchRequestsForProperty(agentA, unshared)).toEqual([]);
    // Nobody from the listing's office can touch the foreign request.
    await expect(setBuyerRequestActive(agentA, openRequest, false)).rejects.toBeInstanceOf(NotFoundError);
    await expect(dismissMatch(agentA, openRequest, sharedId)).rejects.toBeInstanceOf(NotFoundError);
    expect(hiddenRequest).not.toBe(openRequest);
  });
});

describe("match inbox", () => {
  it("lists matches for the user's own buyers, flags new ones and forgets dismissed ones", async () => {
    const office = await org("Inbox Ofis");
    const boss = await member(office, "Inbox Ofis", "owner");
    const anna = await member(office, "Inbox Ofis", "agent");
    const ben = await member(office, "Inbox Ofis", "agent");
    const annasBuyer = await createContact(anna, { fullName: "Annas Käufer", kind: "buyer" });
    const requestId = await createBuyerRequest(anna, wish(annasBuyer, { city: "Konya", maxPrice: 400_000 }));
    const good = await createProperty(ben, flat({ title: "Passt", city: "Konya" }));
    await createProperty(ben, flat({ title: "Zu teuer", city: "Konya", price: 900_000 }));
    await createProperty(ben, flat({ title: "Falsche Stadt", city: "Adana" }));
    await createProperty(ben, flat({ title: "Andere Währung", city: "Konya", currency: "TRY" }));
    await createProperty(ben, flat({ title: "Reserviert", city: "Konya", status: "reserved" }));

    const inbox = await listMatchInbox(anna);
    expect(inbox.map((m) => [m.property.title, m.contact.fullName, m.isNew, m.network])).toEqual([["Passt", "Annas Käufer", true, null]]);
    expect(await listMatchInbox(ben)).toEqual([]);
    expect((await listMatchInbox(boss)).map((m) => m.property.title)).toEqual(["Passt"]);

    await markMatchesSeen(anna);
    expect((await listMatchInbox({ ...anna })).map((m) => m.isNew)).toEqual([false]);
    // A price change makes the match new again.
    await updateProperty(ben, good, flat({ title: "Passt", city: "Konya", price: 290_000 }));
    expect((await listMatchInbox({ ...anna })).map((m) => m.isNew)).toEqual([true]);

    await expect(dismissMatch(ben, requestId, good)).rejects.toBeInstanceOf(NotFoundError);
    await dismissMatch(anna, requestId, good);
    await dismissMatch(anna, requestId, good);
    expect(await listMatchInbox({ ...anna })).toEqual([]);
    expect(await matchPropertiesForRequest(anna, await requestRow(requestId))).toEqual([]);
  });
});

describe("share links", () => {
  it("serves only the sending office's public listing facts, counts views and dies on revoke or expiry", async () => {
    const contactId = await createContact(agentA, { fullName: "Link Empfängerin", kind: "buyer", phone: "+90 555 999 88 77" });
    const own = await createProperty(agentA, flat({ title: "Im Link", city: "Mersin", ...SECRET }));
    const gone = await createProperty(agentA, flat({ title: "Zurückgezogen", city: "Mersin" }));
    const foreign = await createProperty(outsider, flat({ title: "Fremdes Objekt im Link" }));

    await expect(createShare(agentB, contactId, [own])).rejects.toBeInstanceOf(NotFoundError);
    await expect(createShare(agentA, contactId, [foreign])).rejects.toBeInstanceOf(NotFoundError);
    const token = await createShare(agentA, contactId, [gone, foreign, own]);
    expect(await db.select().from(shares).where(eq(shares.tokenHash, token))).toEqual([]);

    await updateProperty(agentA, gone, flat({ title: "Zurückgezogen", city: "Mersin", status: "withdrawn" }));
    const page = await resolveShare(token);
    expect(page?.properties.map((p) => p.title)).toEqual(["Im Link"]);
    expect(page?.agent).toEqual({ fullName: agentA.fullName, phone: null, email: agentA.email });
    expect(JSON.stringify(page)).not.toMatch(/Gizli Sokak|2030-01-01|Empfängerin|555 999|Fremdes/);
    expect(await resolveShare(token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(await resolveShare("")).toBeNull();

    await resolveShare(token);
    const [listed] = await listSharesForContact(agentA, contactId);
    expect(listed).toMatchObject({ viewCount: 2, count: 2 });
    await expect(listSharesForContact(agentB, contactId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(revokeShare(outsider, listed!.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(revokeShare(agentB, listed!.id)).rejects.toBeInstanceOf(NotFoundError);

    const expiring = await createShare(agentA, contactId, [own]);
    await db.update(shares).set({ expiresAt: new Date(Date.now() - 1000) }).where(sql`${shares.viewCount} = 0`);
    expect(await resolveShare(expiring)).toBeNull();

    await revokeShare(owner, listed!.id);
    expect(await resolveShare(token)).toBeNull();
    expect((await db.select().from(properties).where(eq(properties.id, own)))[0]?.title).toBe("Im Link");
  });
});

describe("pdf data", () => {
  it("drops other offices' properties from a presentation and keeps the requested order", async () => {
    const foreign = await createProperty(outsider, flat({ title: "Fremd" }));
    const first = await createProperty(agentA, flat({ title: "Erstes", livingRooms: 1 }));
    const second = await createProperty(agentB, flat({ title: "Zweites" }));
    const result = await getPropertiesByIds(agentA, [second, foreign, first]);
    expect(result.map((p) => p.title)).toEqual(["Zweites", "Erstes"]);
    expect(result[1]?.livingRooms).toBe(1);
    expect(await getComparables(outsider, [first, second])).toEqual([]);
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
