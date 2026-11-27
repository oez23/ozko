"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formattersFor, messagesFor, type Locale } from "./index";

const LocaleContext = createContext<Locale | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error("useI18n must be used inside I18nProvider");
  return useMemo(() => ({ locale, m: messagesFor(locale), f: formattersFor(locale) }), [locale]);
}
