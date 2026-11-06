"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { translator, type T } from "@/lib/i18n/translate";

const Ctx = createContext<Locale>("fr");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  return useContext(Ctx);
}

/** Traduction côté navigateur (composants « use client »). */
export function useT(): T {
  const locale = useContext(Ctx);
  return useMemo(() => translator(locale), [locale]);
}
