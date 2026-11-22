"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, localizeHref, splitLocale, type Locale } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

/** Sélecteur FR | IT | ع : même page dans l'autre langue (lien simple, le choix est mémorisé). */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const { path } = splitLocale(pathname);
  const q = new URLSearchParams(params?.toString() ?? "");
  q.delete("lang");
  const rest = q.toString();
  const hrefOf = (l: Locale) => (l === "fr" ? `${path}?${rest ? `${rest}&` : ""}lang=fr` : localizeHref(`${path}${rest ? `?${rest}` : ""}`, l));
  return (
    <span dir="ltr" className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-white/80 p-0.5 ${className}`} role="group" aria-label="Langue / Lingua / اللغة">
      {LOCALES.map((l) => (
        <a
          key={l}
          href={hrefOf(l)}
          hrefLang={l}
          lang={l}
          title={LOCALE_NAMES[l]}
          aria-label={LOCALE_NAMES[l]}
          aria-current={locale === l ? "true" : undefined}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tracking-wider transition ${locale === l ? "bg-navy text-white" : "text-navy/70 hover:text-navy"}`}
        >
          {LOCALE_SHORT[l]}
        </a>
      ))}
    </span>
  );
}
