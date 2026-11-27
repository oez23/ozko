import { z } from "zod";

export const PROPERTY_TYPES = ["apartment", "house", "villa", "land", "commercial"] as const;
export const DEAL_TYPES = ["sale", "rent"] as const;
export const PROPERTY_STATUSES = ["draft", "active", "reserved", "closed", "withdrawn"] as const;
export const CURRENCIES = ["EUR", "TRY", "USD"] as const;
export const ROLES = ["owner", "admin", "agent"] as const;
export const CONTACT_KINDS = ["buyer", "seller", "tenant", "landlord", "other"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type DealType = (typeof DEAL_TYPES)[number];
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type Role = (typeof ROLES)[number];
export type ContactKind = (typeof CONTACT_KINDS)[number];

/** HTML forms and CSV cells send "" for empty fields; treat that as "not provided". */
const blank = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());

const text = (max: number) => z.string().trim().min(1).max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT erwartet");

export const propertyInputSchema = z.object({
  title: z.string().trim().min(3, "Titel ist zu kurz").max(160),
  dealType: z.enum(DEAL_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  status: z.preprocess(blank, z.enum(PROPERTY_STATUSES).default("active")),
  price: z.coerce.number().int("Preis muss eine ganze Zahl sein").positive().max(1_000_000_000_000),
  currency: z.preprocess(blank, z.enum(CURRENCIES).default("EUR")),
  city: text(80),
  district: optional(text(80)),
  address: optional(text(240)),
  areaSqm: optional(z.coerce.number().positive().max(10_000_000)),
  rooms: optional(z.coerce.number().min(0).max(50)),
  bathrooms: optional(z.coerce.number().int().min(0).max(50)),
  floor: optional(z.coerce.number().int().min(-5).max(200)),
  yearBuilt: optional(z.coerce.number().int().min(1700).max(2100)),
  description: optional(z.string().trim().max(5000)),
  ownerContactId: optional(z.uuid()),
  mandateEndsOn: optional(isoDate),
});
export type PropertyInput = z.infer<typeof propertyInputSchema>;

export const contactInputSchema = z.object({
  fullName: z.string().trim().min(2, "Name ist zu kurz").max(120),
  kind: z.preprocess(blank, z.enum(CONTACT_KINDS).default("buyer")),
  phone: optional(z.string().trim().min(5).max(40)),
  email: optional(z.email().max(200)),
  notes: optional(z.string().trim().max(5000)),
});
export type ContactInput = z.infer<typeof contactInputSchema>;

export const buyerRequestInputSchema = z
  .object({
    contactId: z.uuid(),
    dealType: z.enum(DEAL_TYPES),
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).min(1, "Mindestens eine Objektart wählen"),
    city: text(80),
    districts: z.array(text(80)).max(20).default([]),
    currency: z.preprocess(blank, z.enum(CURRENCIES).default("EUR")),
    minPrice: optional(z.coerce.number().int().min(0)),
    maxPrice: optional(z.coerce.number().int().positive()),
    minAreaSqm: optional(z.coerce.number().positive()),
    maxAreaSqm: optional(z.coerce.number().positive()),
    minRooms: optional(z.coerce.number().min(0).max(50)),
    notes: optional(z.string().trim().max(2000)),
  })
  .refine((r) => r.minPrice === undefined || r.maxPrice === undefined || r.minPrice <= r.maxPrice, {
    message: "Mindestpreis liegt über dem Höchstpreis",
    path: ["maxPrice"],
  })
  .refine((r) => r.minAreaSqm === undefined || r.maxAreaSqm === undefined || r.minAreaSqm <= r.maxAreaSqm, {
    message: "Mindestfläche liegt über der Höchstfläche",
    path: ["maxAreaSqm"],
  });
export type BuyerRequestInput = z.infer<typeof buyerRequestInputSchema>;

export const credentialsSchema = z.object({
  email: z.email().max(200).transform((e) => e.toLowerCase()),
  password: z.string().min(10, "Passwort braucht mindestens 10 Zeichen").max(200),
});

export const registrationSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().min(2).max(120),
});

/** Case- and diacritic-insensitive key for place names ("İzmir" = "izmir" = "Izmir"). */
export function placeKey(name: string): string {
  return name
    .trim()
    .replace(/[İIı]/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}
