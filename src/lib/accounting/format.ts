/** Formats d'affichage des montants comptables (FCFA, sans décimales). Pur. */
export const fcfa = (v: number) => `${(Math.round(v) || 0).toLocaleString("fr-FR")} F`;
export const num = (v: number) => (v ? Math.round(v).toLocaleString("fr-FR") : "");
export const pct = (part: number, total: number) => (total ? `${((part / total) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—");
export const dateFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
