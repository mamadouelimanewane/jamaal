"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { localizeHref, splitLocale } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

/** Sélecteur FR | IT : même page dans l'autre langue (lien simple, le choix est mémorisé). */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const { path } = splitLocale(pathname);
  const q = new URLSearchParams(params?.toString() ?? "");
  q.delete("lang");
  const rest = q.toString();
  const fr = `${path}?${rest ? `${rest}&` : ""}lang=fr`;
  const it = localizeHref(`${path}${rest ? `?${rest}` : ""}`, "it");
  const item = (l: "fr" | "it", href: string, label: string, name: string) => (
    <a
      href={href}
      hrefLang={l}
      lang={l}
      aria-label={name}
      aria-current={locale === l ? "true" : undefined}
      className={`rounded-full px-2 py-0.5 text-xs font-semibold tracking-wider transition ${locale === l ? "bg-navy text-white" : "text-navy/70 hover:text-navy"}`}
    >
      {label}
    </a>
  );
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-white/80 p-0.5 ${className}`} role="group" aria-label="Langue / Lingua">
      {item("fr", fr, "FR", "Français")}
      {item("it", it, "IT", "Italiano")}
    </span>
  );
}
