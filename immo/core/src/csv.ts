import { propertyInputSchema, type PropertyInput } from "./domain";

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

const COLUMN_ALIASES: Record<keyof PropertyInput, string[]> = {
  title: ["title", "titel", "baslik", "başlık"],
  dealType: ["dealtype", "deal_type", "vermarktung", "islem", "işlem"],
  propertyType: ["propertytype", "property_type", "objektart", "tip", "emlak tipi"],
  status: ["status", "durum"],
  price: ["price", "preis", "fiyat"],
  currency: ["currency", "waehrung", "währung", "para birimi"],
  city: ["city", "stadt", "il", "sehir", "şehir"],
  district: ["district", "stadtteil", "ilce", "ilçe"],
  address: ["address", "adresse", "adres"],
  areaSqm: ["areasqm", "area", "flaeche", "fläche", "m2", "metrekare"],
  rooms: ["rooms", "zimmer", "oda"],
  bathrooms: ["bathrooms", "baeder", "bäder", "banyo"],
  floor: ["floor", "etage", "kat"],
  yearBuilt: ["yearbuilt", "baujahr", "yapim yili", "yapım yılı"],
  description: ["description", "beschreibung", "aciklama", "açıklama"],
  ownerContactId: ["ownercontactid"],
  mandateEndsOn: ["mandateendson", "mandat bis", "sozlesme bitis", "sözleşme bitiş"],
};

const VALUE_ALIASES: Partial<Record<keyof PropertyInput, Record<string, string>>> = {
  dealType: { kauf: "sale", verkauf: "sale", satilik: "sale", satılık: "sale", miete: "rent", kiralik: "rent", kiralık: "rent" },
  propertyType: {
    wohnung: "apartment", daire: "apartment", haus: "house", ev: "house", mustakil: "house", müstakil: "house",
    grundstueck: "land", grundstück: "land", arsa: "land", gewerbe: "commercial", ticari: "commercial", isyeri: "commercial", işyeri: "commercial",
  },
  status: { entwurf: "draft", aktiv: "active", aktif: "active", reserviert: "reserved", verkauft: "closed", satildi: "closed", satıldı: "closed" },
};

export type ImportError = { line: number; message: string };
export type ImportResult = { rows: PropertyInput[]; errors: ImportError[]; unknownColumns: string[] };

export function parsePropertyCsv(input: string): ImportResult {
  const table = parseCsv(input);
  const [header, ...body] = table;
  if (!header) return { rows: [], errors: [{ line: 1, message: "Datei ist leer" }], unknownColumns: [] };

  const columns = header.map((raw) => {
    const name = raw.trim().toLowerCase();
    const hit = (Object.entries(COLUMN_ALIASES) as [keyof PropertyInput, string[]][]).find(([, aliases]) =>
      aliases.includes(name),
    );
    return hit?.[0] ?? null;
  });
  const unknownColumns = header.filter((_, i) => columns[i] === null).map((h) => h.trim());
  const missing = (["title", "dealType", "propertyType", "price", "city"] as const).filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, message: `Pflichtspalten fehlen: ${missing.join(", ")}` }], unknownColumns };
  }
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Maximal ${MAX_IMPORT_ROWS} Zeilen pro Import` }], unknownColumns };
  }

  const rows: PropertyInput[] = [];
  const errors: ImportError[] = [];
  body.forEach((cells, index) => {
    const record: Record<string, string> = {};
    columns.forEach((column, i) => {
      if (!column) return;
      const value = (cells[i] ?? "").trim();
      record[column] = VALUE_ALIASES[column]?.[value.toLowerCase()] ?? value;
    });
    if (record.price) record.price = record.price.replace(/[\s.](?=\d{3}\b)/g, "");
    const parsed = propertyInputSchema.safeParse(record);
    if (parsed.success) rows.push(parsed.data);
    else {
      const issue = parsed.error.issues[0]!;
      errors.push({ line: index + 2, message: `${issue.path.join(".")}: ${issue.message}` });
    }
  });
  return { rows, errors, unknownColumns };
}
