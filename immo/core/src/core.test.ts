import { describe, expect, it } from "vitest";
import {
  buyerRequestInputSchema, canAccessContact, formatRooms, canEditProperty, estimateValue, parseCsv, parsePropertyCsv,
  placeKey, propertyInputSchema, rankMatches, scoreMatch, type MatchProperty, type MatchRequest,
} from "./index";

const property: MatchProperty = {
  dealType: "sale", propertyType: "apartment", status: "active", price: 300_000, currency: "EUR",
  city: "İzmir", district: "Karşıyaka", areaSqm: 110, rooms: 3,
};
const request: MatchRequest = {
  dealType: "sale", propertyTypes: ["apartment", "house"], city: "izmir", districts: ["Karsiyaka"],
  currency: "EUR", minPrice: 250_000, maxPrice: 320_000, minAreaSqm: 90, maxAreaSqm: 130, minRooms: 3,
};

describe("placeKey", () => {
  it("ignores case, diacritics and Turkish dotted/dotless i", () => {
    expect(placeKey("İzmir")).toBe(placeKey("izmir"));
    expect(placeKey("ISPARTA")).toBe(placeKey("ısparta"));
    expect(placeKey(" Karşıyaka ")).toBe("karsiyaka");
  });
});

describe("formatRooms", () => {
  it("uses the Turkish room+living-room notation when both are known", () => {
    expect(formatRooms(3, 1)).toBe("3+1");
    expect(formatRooms(1, 0)).toBe("1+0");
    expect(formatRooms(2.5, null)).toBe("2.5");
    expect(formatRooms(null, 1)).toBeNull();
  });
});

describe("scoreMatch", () => {
  it("gives a perfect fit 100", () => {
    expect(scoreMatch(property, request)).toEqual({
      score: 100, reasons: ["price_in_budget", "district_match", "area_fits", "rooms_fit"],
    });
  });
  it.each([
    ["inactive status", { status: "reserved" }],
    ["other deal type", { dealType: "rent" }],
    ["unwanted property type", { propertyType: "land" }],
    ["other currency", { currency: "TRY" }],
    ["other city", { city: "Ankara" }],
    ["price more than 10% over budget", { price: 352_001 }],
  ] as const)("rejects %s", (_, patch) => {
    expect(scoreMatch({ ...property, ...patch }, request)).toBeNull();
  });
  it("keeps a slightly over-budget listing with a reduced score", () => {
    const result = scoreMatch({ ...property, price: 336_000 }, request)!;
    expect(result.reasons).toContain("price_slightly_over");
    expect(result.score).toBe(70);
  });
  it("accepts exactly 10% over budget at the boundary", () => {
    expect(scoreMatch({ ...property, price: 352_000 }, request)?.score).toBe(60);
  });
  it("penalises a wrong district and missing rooms", () => {
    const result = scoreMatch({ ...property, district: "Bornova", rooms: 1 }, request)!;
    expect(result.reasons).toEqual(["price_in_budget", "district_other", "area_fits", "rooms_short"]);
    expect(result.score).toBe(60);
  });
  it("gives half credit when the property lacks a requested attribute", () => {
    expect(scoreMatch({ ...property, areaSqm: null, rooms: null }, request)?.score).toBe(40 + 25 + 10 + 8);
  });
  it("ranks by score and drops matches under the threshold", () => {
    const pool = [
      { id: "weak", ...property, district: "Bornova", rooms: 1, areaSqm: 300 },
      { id: "ok", ...property, district: "Bornova" },
      { id: "best", ...property },
    ];
    expect(rankMatches(pool, (p) => scoreMatch(p, request)).map((m) => m.item.id)).toEqual(["best", "ok"]);
  });
});

describe("estimateValue", () => {
  const comps = [2000, 2200, 2400, 2600, 2800].map((perSqm, i) => ({ id: `c${i}`, price: perSqm * 100, areaSqm: 100 }));
  it("uses the median price per m² and the interquartile range", () => {
    const v = estimateValue(120, comps);
    expect(v).toMatchObject({
      ok: true, comparablesUsed: 5,
      pricePerSqm: { low: 2200, median: 2400, high: 2600 },
      estimate: { low: 264_000, mid: 288_000, high: 312_000 },
      confidence: "medium",
    });
  });
  it("ignores comparables of a very different size", () => {
    const v = estimateValue(120, [...comps, { id: "huge", price: 9_000_000, areaSqm: 900 }]);
    expect(v.ok && v.comparableIds).not.toContain("huge");
  });
  it("refuses to estimate from too few comparables or without an area", () => {
    expect(estimateValue(120, comps.slice(0, 2))).toEqual({ ok: false, reason: "insufficient_comparables", comparablesUsed: 2 });
    expect(estimateValue(null, comps)).toEqual({ ok: false, reason: "missing_area", comparablesUsed: 0 });
  });
});

describe("schemas", () => {
  it("treats blank form fields as absent and applies defaults", () => {
    const parsed = propertyInputSchema.parse({
      title: "Helle Wohnung", dealType: "sale", propertyType: "apartment", price: "250000", city: "Berlin",
      status: "", currency: "", district: "", areaSqm: "", rooms: "2.5",
    });
    expect(parsed).toMatchObject({ status: "active", currency: "TRY", price: 250000, rooms: 2.5 });
    expect(parsed.district).toBeUndefined();
    expect(parsed.areaSqm).toBeUndefined();
  });
  it("rejects non-positive and fractional prices", () => {
    const base = { title: "Wohnung", dealType: "sale", propertyType: "apartment", city: "Berlin" };
    expect(propertyInputSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
    expect(propertyInputSchema.safeParse({ ...base, price: "1000.5" }).success).toBe(false);
  });
  it("rejects an inverted budget", () => {
    const result = buyerRequestInputSchema.safeParse({
      contactId: "6f9619ff-8b86-4d11-b42d-00c04fc964ff", dealType: "sale", propertyTypes: ["apartment"],
      city: "Berlin", minPrice: 500, maxPrice: 100,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: "custom", message: "min_over_max_price", path: ["maxPrice"] });
  });
});

describe("csv import", () => {
  it("parses quoted fields, embedded delimiters and escaped quotes", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("maps German/Turkish headers and values, reports bad rows with line numbers", () => {
    const csv = [
      "Titel;Vermarktung;Objektart;Preis;Stadt;Zimmer;Extra",
      "Wohnung am Park;Kauf;Wohnung;250.000;Berlin;3;x",
      "Zu kurz;Kauf;Wohnung;abc;Berlin;3;x",
      "Deniz manzaralı daire;satılık;daire;4 500 000;İzmir;3+1;x",
    ].join("\n");
    const result = parsePropertyCsv(csv);
    expect(result.unknownColumns).toEqual(["Extra"]);
    expect(result.rows.map((r) => [r.title, r.dealType, r.propertyType, r.price])).toEqual([
      ["Wohnung am Park", "sale", "apartment", 250000],
      ["Deniz manzaralı daire", "sale", "apartment", 4500000],
    ]);
    expect(result.rows.map((r) => [r.rooms, r.livingRooms])).toEqual([[3, undefined], [3, 1]]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ line: 3, code: "invalid_row", field: "price" });
  });
  it("recognises Turkish headers and values whatever their letter case", () => {
    // toLowerCase() maps "İ" to "i̇" and "I" to "i", so these exact spellings used to be rejected.
    const csv = [
      "BAŞLIK;İŞLEM;TİP;FİYAT;İL;İLÇE;DURUM",
      "Site içinde daire;SATILIK;DAİRE;4500000;İzmir;Karşıyaka;AKTİF",
      "Kiralık işyeri;Kiralık;İşyeri;60000;İstanbul;Kadıköy;Opsiyonlu",
    ].join("\n");
    const result = parsePropertyCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.unknownColumns).toEqual([]);
    expect(result.rows.map((r) => [r.dealType, r.propertyType, r.status, r.city, r.district])).toEqual([
      ["sale", "apartment", "active", "İzmir", "Karşıyaka"],
      ["rent", "commercial", "reserved", "İstanbul", "Kadıköy"],
    ]);
  });
  it("fails fast when required columns are missing", () => {
    expect(parsePropertyCsv("Titel;Preis\nA;1").errors[0]).toEqual({
      line: 1, code: "missing_columns", columns: ["dealType", "propertyType", "city"],
    });
    expect(parsePropertyCsv("").errors[0]).toEqual({ line: 1, code: "empty_file" });
  });
});

describe("permissions", () => {
  const agent = { userId: "u1", role: "agent" } as const;
  it("lets agents change only their own records, managers everything", () => {
    expect(canEditProperty(agent, "u1")).toBe(true);
    expect(canEditProperty(agent, "u2")).toBe(false);
    expect(canAccessContact(agent, "u2")).toBe(false);
    expect(canAccessContact({ userId: "u9", role: "admin" }, "u2")).toBe(true);
  });
});
