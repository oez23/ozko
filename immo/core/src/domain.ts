import { z } from "zod";

export const PROPERTY_TYPES = ["apartment", "house", "villa", "land", "commercial"] as const;
export const DEAL_TYPES = ["sale", "rent"] as const;
export const PROPERTY_STATUSES = ["draft", "active", "reserved", "closed", "withdrawn"] as const;
/** Storage order; it mirrors the database enum, so reordering it would force a type rebuild. */
export const CURRENCIES = ["EUR", "TRY", "USD"] as const;
export const DEFAULT_CURRENCY = "TRY" satisfies (typeof CURRENCIES)[number];
/** Display order for pickers: the home currency first. */
export const CURRENCY_CHOICES = ["TRY", "USD", "EUR"] as const satisfies readonly (typeof CURRENCIES)[number][];
export const MIN_PASSWORD_LENGTH = 10;
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
/** Checkboxes arrive as "on" from forms and as booleans from JSON clients; absent means unchecked. */
const flag = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const propertyInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  dealType: z.enum(DEAL_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  status: z.preprocess(blank, z.enum(PROPERTY_STATUSES).default("active")),
  price: z.coerce.number().int().positive().max(1_000_000_000_000),
  currency: z.preprocess(blank, z.enum(CURRENCIES).default(DEFAULT_CURRENCY)),
  city: text(80),
  district: optional(text(80)),
  address: optional(text(240)),
  areaSqm: optional(z.coerce.number().positive().max(10_000_000)),
  rooms: optional(z.coerce.number().min(0).max(50)),
  /** Turkish listings quote rooms as "3+1": bedrooms plus living rooms. */
  livingRooms: optional(z.coerce.number().int().min(0).max(10)),
  bathrooms: optional(z.coerce.number().int().min(0).max(50)),
  floor: optional(z.coerce.number().int().min(-5).max(200)),
  yearBuilt: optional(z.coerce.number().int().min(1700).max(2100)),
  description: optional(z.string().trim().max(5000)),
  ownerContactId: optional(z.uuid()),
  mandateEndsOn: optional(isoDate),
  /** Opt-in: lets agents of other offices find this listing for their buyers. */
  sharedWithNetwork: flag,
});
export type PropertyInput = z.infer<typeof propertyInputSchema>;

export const contactInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
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
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).min(1),
    city: text(80),
    districts: z.array(text(80)).max(20).default([]),
    currency: z.preprocess(blank, z.enum(CURRENCIES).default(DEFAULT_CURRENCY)),
    minPrice: optional(z.coerce.number().int().min(0)),
    maxPrice: optional(z.coerce.number().int().positive()),
    minAreaSqm: optional(z.coerce.number().positive()),
    maxAreaSqm: optional(z.coerce.number().positive()),
    minRooms: optional(z.coerce.number().min(0).max(50)),
    notes: optional(z.string().trim().max(2000)),
    /** Opt-in: tells other offices that a matching buyer exists, never who the buyer is. */
    sharedWithNetwork: flag,
  })
  .refine((r) => r.minPrice === undefined || r.maxPrice === undefined || r.minPrice <= r.maxPrice, {
    message: "min_over_max_price",
    path: ["maxPrice"],
  })
  .refine((r) => r.minAreaSqm === undefined || r.maxAreaSqm === undefined || r.minAreaSqm <= r.maxAreaSqm, {
    message: "min_over_max_area",
    path: ["maxAreaSqm"],
  });
export type BuyerRequestInput = z.infer<typeof buyerRequestInputSchema>;

export const credentialsSchema = z.object({
  email: z.email().max(200).transform((e) => e.toLowerCase()),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: optional(z.string().trim().min(5).max(40)),
});

export const registrationSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(120),
  phone: optional(z.string().trim().min(5).max(40)),
  organizationName: z.string().trim().min(2).max(120),
});

/** "3+1" for three rooms plus one living room; plain room count when the living rooms are unknown. */
export function formatRooms(rooms: number | null | undefined, livingRooms: number | null | undefined): string | null {
  if (rooms == null) return null;
  return livingRooms == null ? String(rooms) : `${rooms}+${livingRooms}`;
}

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
