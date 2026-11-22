"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { translator, type T } from "@/lib/i18n/translate";
import { MRU_DEFAULT_RATE, priceFormatter, type PriceFormatter } from "@/lib/currency";

const Ctx = createContext<Locale>("fr");
const RateCtx = createContext<number>(MRU_DEFAULT_RATE);

export function LocaleProvider({ locale, mruRate = MRU_DEFAULT_RATE, children }: { locale: Locale; mruRate?: number; children: React.ReactNode }) {
  return (
    <Ctx.Provider value={locale}>
      <RateCtx.Provider value={mruRate}>{children}</RateCtx.Provider>
    </Ctx.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(Ctx);
}

/** Traduction côté navigateur (composants « use client »). */
export function useT(): T {
  const locale = useContext(Ctx);
  return useMemo(() => translator(locale), [locale]);
}

/** Prix affiché dans la langue de la page : ouguiya (MRU) en arabe, FCFA sinon. */
export function usePrice(): PriceFormatter {
  const locale = useContext(Ctx);
  const rate = useContext(RateCtx);
  return useMemo(() => priceFormatter(locale, rate), [locale, rate]);
}
