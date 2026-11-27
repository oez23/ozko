import type { z } from "zod";
import { placeKey, propertyInputSchema, type PropertyInput } from "./domain";

export const MAX_IMPORT_ROWS = 2000;

/** RFC 4180 parser with quoted fields; the delimiter is detected from the header line. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const headerEnd = text.search(/\r?\n/);
  const header = headerEnd === -1 ? text : text.slice(0, headerEnd);
  const delimiter = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Headers and enum values are compared through placeKey(), so "İşlem", "ISLEM" and "işlem"
 * are the same column. Plain toLowerCase() turns "İ" into "i" plus a combining dot and
 * "I" into "i" instead of "ı", which silently broke Turkish files.
 * Aliases are therefore written in their normalised form: lower case, no diacritics.
 */
const COLUMN_ALIASES: Record<keyof PropertyInput, string[]> = {
  title: ["title", "titel", "baslik", "ilan basligi"],
  dealType: ["dealtype", "deal_type", "vermarktung", "islem", "islem turu"],
  propertyType: ["propertytype", "property_type", "objektart", "tip", "emlak tipi"],
  status: ["status", "durum"],
  price: ["price", "preis", "fiyat"],
  currency: ["currency", "wahrung", "waehrung", "para birimi"],
  city: ["city", "stadt", "il", "sehir"],
  district: ["district", "stadtteil", "bezirk", "ilce"],
  address: ["address", "adresse", "adres"],
  areaSqm: ["areasqm", "area", "flache", "flaeche", "m2", "metrekare", "alan"],
  rooms: ["rooms", "zimmer", "oda", "oda sayisi"],
  livingRooms: ["livingrooms", "wohnzimmer", "salon"],
  bathrooms: ["bathrooms", "bader", "baeder", "banyo"],
  floor: ["floor", "etage", "kat"],
  yearBuilt: ["yearbuilt", "baujahr", "yapim yili"],
  description: ["description", "beschreibung", "aciklama"],
  ownerContactId: ["ownercontactid"],
  mandateEndsOn: ["mandateendson", "mandat bis", "sozlesme bitis", "yetki bitis"],
  // Sharing with other offices is a deliberate per-listing decision, never something a bulk file switches on.
  sharedWithNetwork: [],
};

const VALUE_ALIASES: Partial<Record<keyof PropertyInput, Record<string, string>>> = {
  dealType: { kauf: "sale", verkauf: "sale", satilik: "sale", miete: "rent", kiralik: "rent" },
  propertyType: {
    wohnung: "apartment", daire: "apartment", haus: "house", ev: "house", mustakil: "house", "mustakil ev": "house",
    grundstuck: "land", grundstueck: "land", arsa: "land", gewerbe: "commercial", ticari: "commercial", isyeri: "commercial",
  },
  status: {
    entwurf: "draft", taslak: "draft", aktiv: "active", aktif: "active", reserviert: "reserved", opsiyonlu: "reserved",
    verkauft: "closed", satildi: "closed", kiralandi: "closed", tamamlandi: "closed",
  },
};

/** Codes instead of prose so each client renders them in its own language. */
export type ImportError =
  | { line: 1; code: "empty_file" | "too_many_rows" }
  | { line: 1; code: "missing_columns"; columns: string[] }
  | { line: number; code: "invalid_row"; field: string; issue: z.core.$ZodIssue };
export type ImportResult = { rows: PropertyInput[]; errors: ImportError[]; unknownColumns: string[] };

export function parsePropertyCsv(input: string): ImportResult {
  const table = parseCsv(input);
  const [header, ...body] = table;
  if (!header) return { rows: [], errors: [{ line: 1, code: "empty_file" }], unknownColumns: [] };

  const columns = header.map((raw) => {
    const name = placeKey(raw);
    const hit = (Object.entries(COLUMN_ALIASES) as [keyof PropertyInput, string[]][]).find(([, aliases]) =>
      aliases.includes(name),
    );
    return hit?.[0] ?? null;
  });
  const unknownColumns = header.filter((_, i) => columns[i] === null).map((h) => h.trim());
  const missing = (["title", "dealType", "propertyType", "price", "city"] as const).filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, code: "missing_columns", columns: missing }], unknownColumns };
  }
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, code: "too_many_rows" }], unknownColumns };
  }

  const rows: PropertyInput[] = [];
  const errors: ImportError[] = [];
  body.forEach((cells, index) => {
    const record: Record<string, string> = {};
    columns.forEach((column, i) => {
      if (!column) return;
      const value = (cells[i] ?? "").trim();
      record[column] = VALUE_ALIASES[column]?.[placeKey(value)] ?? value;
    });
    if (record.price) record.price = record.price.replace(/[\s.](?=\d{3}\b)/g, "");
    const roomsPlus = record.rooms?.match(/^(\d+(?:[.,]5)?)\s*\+\s*(\d+)$/);
    if (roomsPlus) {
      record.rooms = roomsPlus[1]!.replace(",", ".");
      record.livingRooms = roomsPlus[2]!;
    }
    const parsed = propertyInputSchema.safeParse(record);
    if (parsed.success) rows.push(parsed.data);
    else {
      const issue = parsed.error.issues[0]!;
      errors.push({ line: index + 2, code: "invalid_row", field: String(issue.path[0] ?? ""), issue });
    }
  });
  return { rows, errors, unknownColumns };
}
