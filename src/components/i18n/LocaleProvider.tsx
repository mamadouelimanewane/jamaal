"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { translator, type T } from "@/lib/i18n/translate";
import { priceFormatter, type PriceFormatter } from "@/lib/currency";
import { WHATSAPP_CONTACTS, type SiteWhatsApp } from "@/lib/contact";

const Ctx = createContext<Locale>("fr");
/** Taux de la monnaie affichée (FCFA pour 1 ouguiya ou 1 dalasi) ; undefined = taux par défaut ou FCFA. */
const RateCtx = createContext<number | undefined>(undefined);
/** Numéro WhatsApp du site dans cette langue (gambien sur la version anglaise s'il est réglé). */
const WaCtx = createContext<SiteWhatsApp>(WHATSAPP_CONTACTS[0]);

export function LocaleProvider({ locale, rate, whatsapp, children }: { locale: Locale; rate?: number; whatsapp?: SiteWhatsApp; children: React.ReactNode }) {
  return (
    <Ctx.Provider value={locale}>
      <RateCtx.Provider value={rate}>
        <WaCtx.Provider value={whatsapp ?? WHATSAPP_CONTACTS[0]}>{children}</WaCtx.Provider>
      </RateCtx.Provider>
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

/** Prix affiché dans la langue de la page : ouguiya (MRU) en arabe, dalasi (GMD) en anglais, FCFA sinon. */
export function usePrice(): PriceFormatter {
  const locale = useContext(Ctx);
  const rate = useContext(RateCtx);
  return useMemo(() => priceFormatter(locale, rate), [locale, rate]);
}

/** Numéro WhatsApp à afficher sur cette page du site (JAMAAL Gambia sur la version anglaise s'il est réglé). */
export function useSiteWhatsApp(): SiteWhatsApp {
  return useContext(WaCtx);
}
