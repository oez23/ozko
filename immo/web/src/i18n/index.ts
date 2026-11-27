import { formatRooms } from "@immo/core";
import { de } from "./de";
import { tr, type Messages } from "./tr";

export type { Messages };

export const LOCALES = ["tr", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_COOKIE = "immo_locale";
export const LOCALE_NAMES: Record<Locale, string> = { tr: "Türkçe", de: "Deutsch" };

const DICTIONARIES: Record<Locale, Messages> = { tr, de };
const INTL_LOCALES: Record<Locale, string> = { tr: "tr-TR", de: "de-DE" };

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);
export const messagesFor = (locale: Locale): Messages => DICTIONARIES[locale];

/** Fills `{name}` placeholders; an unknown placeholder is left visible so a typo is noticed. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export type Formatters = ReturnType<typeof formattersFor>;

export function formattersFor(locale: Locale) {
  const intl = INTL_LOCALES[locale];
  const number = new Intl.NumberFormat(intl, { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(intl, { dateStyle: "medium" });
  return {
    price: (amount: number, currency: string) =>
      // narrowSymbol: without it German prints "4.800.000 TRY" instead of "4.800.000 ₺".
      new Intl.NumberFormat(intl, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(amount),
    number: (value: number) => number.format(value),
    date: (value: Date | string) => date.format(new Date(value)),
    area: (value: number | null | undefined) => (value == null ? "–" : `${number.format(value)} m²`),
    rooms: (rooms: number | null | undefined, livingRooms: number | null | undefined) =>
      formatRooms(rooms, livingRooms) ?? "–",
  };
}
