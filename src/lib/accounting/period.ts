/** Choix de la période des états (paramètres d'URL). Pur. Dates en UTC (Dakar = UTC+0). */
import type { Period } from "./reports";

export const PRESETS = [
  { id: "mois", label: "Ce mois" },
  { id: "mois-dernier", label: "Mois dernier" },
  { id: "trimestre", label: "Ce trimestre" },
  { id: "annee", label: "Cette année" },
  { id: "annee-derniere", label: "Année dernière" },
  { id: "12-mois", label: "12 derniers mois" },
  { id: "tout", label: "Depuis le début" },
] as const;

export type PeriodChoice = Period & { preset: string; label: string; fromStr: string; toStr: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const U = (y: number, m: number, d = 1) => new Date(Date.UTC(y, m, d));

export function parsePeriod(sp: Record<string, string | string[] | undefined>, now: Date, start: Date, defaultPreset = "mois"): PeriodChoice {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const du = get("du");
  const au = get("au");
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  if (valid(du) && valid(au) && du <= au) {
    const from = new Date(`${du}T00:00:00Z`);
    const to = new Date(new Date(`${au}T00:00:00Z`).getTime() + 86_400_000);
    return { from, to, preset: "perso", label: `du ${fmt(from)} au ${fmt(new Date(to.getTime() - 1))}`, fromStr: du, toStr: au };
  }
  const preset = PRESETS.some((p) => p.id === get("p")) ? get("p") : defaultPreset;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let from: Date, to: Date;
  switch (preset) {
    case "mois-dernier":
      from = U(y, m - 1);
      to = U(y, m);
      break;
    case "trimestre":
      from = U(y, m - (m % 3));
      to = U(y, m - (m % 3) + 3);
      break;
    case "annee":
      from = U(y, 0);
      to = U(y + 1, 0);
      break;
    case "annee-derniere":
      from = U(y - 1, 0);
      to = U(y, 0);
      break;
    case "12-mois":
      from = U(y, m - 11);
      to = U(y, m + 1);
      break;
    case "tout":
      from = start;
      to = U(y, m + 1);
      break;
    default:
      from = U(y, m);
      to = U(y, m + 1);
  }
  const label = PRESETS.find((p) => p.id === preset)?.label ?? "";
  return { from, to, preset, label, fromStr: iso(from), toStr: iso(new Date(to.getTime() - 1)) };
}

export const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** Période précédente de même durée (comparaison N-1 du compte de résultat). */
export function previousPeriod(p: Period): Period {
  const fy = (d: Date) => d.getUTCMonth() === 0 && d.getUTCDate() === 1;
  // Années civiles / mois entiers : même période de l'année précédente.
  if (fy(p.from) && fy(p.to)) return { from: U(p.from.getUTCFullYear() - 1, 0), to: U(p.to.getUTCFullYear() - 1, 0) };
  const len = p.to.getTime() - p.from.getTime();
  return { from: new Date(p.from.getTime() - len), to: p.from };
}
