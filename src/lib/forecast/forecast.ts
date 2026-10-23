/**
 * Prévision des ventes et bon de commande Chogan (pur, testé).
 * - Rythme de base : moyenne pondérée des 8 dernières semaines (les plus récentes comptent plus), hors semaines de fête.
 * - Saisonnalité : fêtes du Sénégal (Korité, Tabaski, Saint-Valentin, fête des mères, fin d'année). L'effet de
 *   chaque fête est appris sur l'historique de l'an dernier quand il existe, sinon un effet type est appliqué.
 * - Bon de commande : de quoi couvrir le délai Chogan + la période de couverture, avec une semaine de sécurité.
 * - Stock dormant : plus de 16 semaines de ventes prévues en stock.
 */
export const DAY = 86_400_000;
export const WEEK = 7 * DAY;

export type SeasonEvent = { id: string; label: string; date: Date; /** jours d'achats avant la date */ before: number; /** jours après */ after: number; defaultUplift: number };

/** Dates des fêtes (Korité et Tabaski suivent le calendrier lunaire : dates prévues, à ± 1 jour). */
const LUNAR: Record<number, { korite: string; tabaski: string }> = {
  2025: { korite: "2025-03-30", tabaski: "2025-06-06" },
  2026: { korite: "2026-03-20", tabaski: "2026-05-27" },
  2027: { korite: "2027-03-10", tabaski: "2027-05-17" },
  2028: { korite: "2028-02-27", tabaski: "2028-05-05" },
  2029: { korite: "2029-02-15", tabaski: "2029-04-24" },
};

/** Dernier dimanche de mai (fête des mères au Sénégal, comme en France). */
function lastSundayOfMay(year: number) {
  const d = new Date(Date.UTC(year, 4, 31));
  d.setUTCDate(31 - d.getUTCDay());
  return d;
}

export function seasonEvents(year: number): SeasonEvent[] {
  const l = LUNAR[year];
  const list: SeasonEvent[] = [
    { id: `valentin-${year}`, label: "Saint-Valentin", date: new Date(Date.UTC(year, 1, 14)), before: 12, after: 0, defaultUplift: 1.5 },
    { id: `meres-${year}`, label: "Fête des mères", date: lastSundayOfMay(year), before: 10, after: 0, defaultUplift: 1.3 },
    { id: `fin-annee-${year}`, label: "Fêtes de fin d'année", date: new Date(Date.UTC(year, 11, 31)), before: 24, after: 0, defaultUplift: 1.6 },
  ];
  if (l) {
    list.push({ id: `korite-${year}`, label: "Korité", date: new Date(`${l.korite}T00:00:00Z`), before: 14, after: 1, defaultUplift: 1.8 });
    list.push({ id: `tabaski-${year}`, label: "Tabaski", date: new Date(`${l.tabaski}T00:00:00Z`), before: 18, after: 1, defaultUplift: 2.2 });
  }
  return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const eventKind = (e: SeasonEvent) => e.id.replace(/-\d{4}$/, "");
const inWindow = (t: number, e: SeasonEvent) => t >= e.date.getTime() - e.before * DAY && t <= e.date.getTime() + e.after * DAY;

/** Fête qui touche la semaine commençant à `weekStart` (la plus forte si plusieurs). */
export function eventForWeek(weekStart: Date, events: SeasonEvent[]): SeasonEvent | null {
  const mid = weekStart.getTime() + 3.5 * DAY;
  return events.filter((e) => inWindow(mid, e)).sort((a, b) => b.defaultUplift - a.defaultUplift)[0] ?? null;
}

/** Début de semaine (lundi, UTC). */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

export type WeeklySales = Map<number, number>; // début de semaine (ms) → unités vendues

/** Effet de chaque fête appris sur l'historique (toutes les lignes du catalogue) : ventes en semaine de fête / rythme normal. */
export function learnUplifts(totals: WeeklySales, now: Date): Record<string, number> {
  const events = [...seasonEvents(now.getUTCFullYear() - 1), ...seasonEvents(now.getUTCFullYear())].filter((e) => e.date.getTime() < now.getTime());
  const out: Record<string, number[]> = {};
  for (const e of events) {
    const evWeeks = [...totals.keys()].filter((w) => eventForWeek(new Date(w), [e]));
    const normal = [...totals.keys()].filter((w) => w < e.date.getTime() - (e.before + 7) * DAY && w >= e.date.getTime() - (e.before + 63) * DAY);
    if (evWeeks.length === 0 || normal.length < 4) continue;
    const ev = evWeeks.reduce((s, w) => s + (totals.get(w) ?? 0), 0) / evWeeks.length;
    const base = normal.reduce((s, w) => s + (totals.get(w) ?? 0), 0) / normal.length;
    if (base < 3) continue; // trop peu de ventes pour apprendre
    (out[eventKind(e)] ??= []).push(Math.min(4, Math.max(1, ev / base)));
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100]));
}

/** Rythme de base (unités / semaine) : 8 dernières semaines complètes, pondérées, hors semaines de fête. */
export function baseline(sales: WeeklySales, now: Date, events: SeasonEvent[]): number {
  const current = weekStart(now).getTime();
  let num = 0;
  let den = 0;
  for (let i = 1; i <= 8; i++) {
    const w = current - i * WEEK;
    if (eventForWeek(new Date(w), events)) continue;
    const weight = 9 - i; // 8 pour la semaine dernière … 1 pour la plus ancienne
    num += (sales.get(w) ?? 0) * weight;
    den += weight;
  }
  return den ? num / den : 0;
}

export type ForecastOptions = { leadWeeks: number; coverWeeks: number; uplifts?: Record<string, number> };
export type LineForecast = {
  weekly: number;
  /** Ventes prévues sur le délai + la couverture */
  demand: number;
  /** Quantité à commander (avec 1 semaine de sécurité), stock et réservations déduits */
  order: number;
  /** Fête qui pèse sur la période, avec son effet */
  event: { label: string; uplift: number } | null;
  weeksOfStock: number | null;
  /** Unités en trop (plus de 16 semaines de ventes prévues) */
  dormant: number;
};

export function forecastLine(sales: WeeklySales, stock: number, reserved: number, now: Date, opts: ForecastOptions): LineForecast {
  const events = [...seasonEvents(now.getUTCFullYear()), ...seasonEvents(now.getUTCFullYear() + 1)];
  const weekly = baseline(sales, now, [...seasonEvents(now.getUTCFullYear() - 1), ...events]);
  const start = weekStart(now).getTime();
  const horizon = opts.leadWeeks + opts.coverWeeks;
  let demand = 0;
  let strongest: { label: string; uplift: number } | null = null;
  for (let i = 0; i < horizon; i++) {
    const e = eventForWeek(new Date(start + i * WEEK), events);
    const uplift = e ? opts.uplifts?.[eventKind(e)] ?? e.defaultUplift : 1;
    if (e && (!strongest || uplift > strongest.uplift)) strongest = { label: e.label, uplift };
    demand += weekly * uplift;
  }
  const safety = weekly; // une semaine de sécurité
  const order = weekly > 0 || reserved > 0 ? Math.max(0, Math.ceil(demand + safety + reserved - Math.max(0, stock))) : 0;
  const weeksOfStock = weekly > 0 ? Math.round((Math.max(0, stock) / weekly) * 10) / 10 : null;
  const dormant = weekly > 0 ? Math.max(0, Math.floor(Math.max(0, stock) - weekly * 16)) : Math.max(0, stock);
  return { weekly: Math.round(weekly * 10) / 10, demand: Math.round(demand * 10) / 10, order, event: strongest, weeksOfStock, dormant };
}

/** Prochaines fêtes (dans les 20 semaines), avec le nombre de semaines avant la date. */
export function upcomingEvents(now: Date, uplifts: Record<string, number> = {}) {
  return [...seasonEvents(now.getUTCFullYear()), ...seasonEvents(now.getUTCFullYear() + 1)]
    .filter((e) => e.date.getTime() >= now.getTime() && e.date.getTime() - now.getTime() <= 20 * WEEK)
    .map((e) => ({ label: e.label, date: e.date, weeks: Math.ceil((e.date.getTime() - now.getTime()) / WEEK), uplift: uplifts[eventKind(e)] ?? e.defaultUplift, learned: eventKind(e) in uplifts }));
}
