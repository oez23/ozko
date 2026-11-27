import { setLocale } from "@/app/actions/auth";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n";

/** Plain form buttons, so switching language works without client JavaScript. */
export function LocaleSwitch({ current }: { current: Locale }) {
  return (
    <form action={setLocale} className="flex gap-3 text-xs">
      {LOCALES.map((locale) => (
        <button key={locale} type="submit" name="locale" value={locale} lang={locale}
          aria-current={locale === current ? "true" : undefined}
          className={locale === current ? "font-semibold text-ink" : "text-muted underline"}>
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </form>
  );
}
