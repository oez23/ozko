import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, formattersFor, isLocale, LOCALE_COOKIE, messagesFor, type Locale } from "./index";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** Messages and formatters for the current request. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, m: messagesFor(locale), f: formattersFor(locale) };
}
