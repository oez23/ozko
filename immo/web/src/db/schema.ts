import { relations, sql } from "drizzle-orm";
import {
  bigint, boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp,
  uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { CONTACT_KINDS, CURRENCIES, DEAL_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES, ROLES } from "@immo/core";

export const roleEnum = pgEnum("role", ROLES);
export const dealTypeEnum = pgEnum("deal_type", DEAL_TYPES);
export const propertyTypeEnum = pgEnum("property_type", PROPERTY_TYPES);
export const propertyStatusEnum = pgEnum("property_status", PROPERTY_STATUSES);
export const currencyEnum = pgEnum("currency", CURRENCIES);
export const contactKindEnum = pgEnum("contact_kind", CONTACT_KINDS);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("memberships_user_idx").on(t.userId)],
);

/** Only the SHA-256 of the session token is stored, so a database leak does not leak live sessions. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => users.id),
    fullName: text("full_name").notNull(),
    kind: contactKindEnum("kind").notNull().default("buyer"),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_org_agent_idx").on(t.orgId, t.agentId)],
);

export const properties = pgTable(
  "properties",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => users.id),
    ownerContactId: uuid("owner_contact_id").references(() => contacts.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    dealType: dealTypeEnum("deal_type").notNull(),
    propertyType: propertyTypeEnum("property_type").notNull(),
    status: propertyStatusEnum("status").notNull().default("active"),
    price: bigint("price", { mode: "number" }).notNull(),
    currency: currencyEnum("currency").notNull().default("EUR"),
    city: text("city").notNull(),
    /** Normalised city, see placeKey(); filters and matching compare on this. */
    cityKey: text("city_key").notNull(),
    district: text("district"),
    address: text("address"),
    areaSqm: doublePrecision("area_sqm"),
    rooms: doublePrecision("rooms"),
    bathrooms: integer("bathrooms"),
    floor: integer("floor"),
    yearBuilt: integer("year_built"),
    description: text("description"),
    mandateEndsOn: date("mandate_ends_on"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("properties_org_status_idx").on(t.orgId, t.status, t.createdAt),
    index("properties_org_match_idx").on(t.orgId, t.dealType, t.cityKey),
  ],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    price: bigint("price", { mode: "number" }).notNull(),
    status: propertyStatusEnum("status").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("price_history_property_idx").on(t.propertyId, t.createdAt)],
);

export const buyerRequests = pgTable(
  "buyer_requests",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => users.id),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    dealType: dealTypeEnum("deal_type").notNull(),
    propertyTypes: propertyTypeEnum("property_types").array().notNull(),
    city: text("city").notNull(),
    cityKey: text("city_key").notNull(),
    districts: text("districts").array().notNull().default(sql`'{}'::text[]`),
    currency: currencyEnum("currency").notNull().default("EUR"),
    minPrice: bigint("min_price", { mode: "number" }),
    maxPrice: bigint("max_price", { mode: "number" }),
    minAreaSqm: doublePrecision("min_area_sqm"),
    maxAreaSqm: doublePrecision("max_area_sqm"),
    minRooms: doublePrecision("min_rooms"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("buyer_requests_org_match_idx").on(t.orgId, t.active, t.dealType, t.cityKey)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    detail: jsonb("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_org_idx").on(t.orgId, t.createdAt)],
);

export const propertiesRelations = relations(properties, ({ one }) => ({
  agent: one(users, { fields: [properties.agentId], references: [users.id] }),
  ownerContact: one(contacts, { fields: [properties.ownerContactId], references: [contacts.id] }),
}));
