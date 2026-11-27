import type { ContactKind, DealType, MatchReason, PropertyStatus, PropertyType, Role } from "@immo/core";

export const DEAL_TYPE_LABELS: Record<DealType, string> = { sale: "Kauf", rent: "Miete" };
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Wohnung", house: "Haus", villa: "Villa", land: "Grundstück", commercial: "Gewerbe",
};
export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Entwurf", active: "Aktiv", reserved: "Reserviert", closed: "Abgeschlossen", withdrawn: "Zurückgezogen",
};
export const ROLE_LABELS: Record<Role, string> = { owner: "Inhaber", admin: "Büroleitung", agent: "Makler" };
export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  buyer: "Käufer", seller: "Verkäufer", tenant: "Mieter", landlord: "Vermieter", other: "Sonstige",
};
export const MATCH_REASON_LABELS: Record<MatchReason, string> = {
  price_in_budget: "Preis im Budget",
  price_below_budget: "Preis unter Budget",
  price_slightly_over: "Preis leicht über Budget",
  district_match: "Wunsch-Stadtteil",
  district_other: "Anderer Stadtteil",
  area_fits: "Fläche passt",
  area_close: "Fläche knapp daneben",
  area_off: "Fläche passt nicht",
  rooms_fit: "Zimmer passen",
  rooms_one_short: "Ein Zimmer weniger",
  rooms_short: "Zu wenige Zimmer",
};

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
}
