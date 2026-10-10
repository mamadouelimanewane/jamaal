/** Réglages comptables (pur). Stockés dans Setting "accounting_settings". */
import type { AccountDef } from "./chart";
import { DEFAULT_POSTING, type PostingSettings } from "./posting";

export type AccountingSettings = PostingSettings & {
  company: { name: string; ninea: string; rccm: string; address: string; regime: string };
  /** Début de la comptabilité (AAAA-MM-JJ). Vide : date de la première opération. */
  startDate: string;
  customAccounts: AccountDef[];
};

export const REGIMES = ["CGU (Contribution Globale Unique)", "Réel simplifié", "Réel normal"];

export const DEFAULT_ACCOUNTING: AccountingSettings = {
  ...DEFAULT_POSTING,
  company: { name: "JAMAAL", ninea: "", rccm: "", address: "Dakar, Sénégal", regime: REGIMES[0] },
  startDate: "",
  customAccounts: [],
};

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pct = (v: unknown, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.round(n * 100) / 100 : def;
};

export function normalizeAccounting(raw: unknown): AccountingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c = (r.company && typeof r.company === "object" ? r.company : {}) as Record<string, unknown>;
  const f = (r.fees && typeof r.fees === "object" ? r.fees : {}) as Record<string, unknown>;
  const start = typeof r.startDate === "string" ? r.startDate.trim() : "";
  const accounts = Array.isArray(r.customAccounts) ? r.customAccounts : [];
  return {
    vatEnabled: r.vatEnabled === true,
    vatRate: (() => {
      const n = Number(r.vatRate);
      return Number.isFinite(n) && n > 0 && n <= 30 ? n : DEFAULT_POSTING.vatRate;
    })(),
    fees: { WAVE: pct(f.WAVE, 0), ORANGE_MONEY: pct(f.ORANGE_MONEY, 0), STRIPE: pct(f.STRIPE, 0) },
    purchaseMode: r.purchaseMode === "RECEPTIONS" ? "RECEPTIONS" : "DEPENSES",
    company: {
      name: str(c.name, 80) || DEFAULT_ACCOUNTING.company.name,
      ninea: str(c.ninea, 40),
      rccm: str(c.rccm, 40),
      address: str(c.address, 160) || DEFAULT_ACCOUNTING.company.address,
      regime: str(c.regime, 60) || DEFAULT_ACCOUNTING.company.regime,
    },
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(start) && !Number.isNaN(Date.parse(start)) && new Date(`${start}T00:00:00Z`).toISOString().startsWith(start) ? start : "",
    customAccounts: accounts
      .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>) : {}))
      .map((a) => ({ code: str(a.code, 8), label: str(a.label, 80) }))
      .filter((a) => /^[1-8]\d{1,7}$/.test(a.code) && a.label)
      .slice(0, 200),
  };
}
