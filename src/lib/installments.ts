/**
 * Paiement en 2 ou 3 fois : la commande est réglée en échéances payées en ligne (Wave ou Orange Money).
 * La première se paie à la commande, les suivantes tous les `intervalDays` jours, avec rappels WhatsApp.
 * La commande est préparée, livrée et commissionnée une fois entièrement payée. Pur, testé.
 */

export interface InstallmentSettings {
  enabled: boolean;
  /** Montant minimal de la commande (FCFA) pour proposer le paiement en plusieurs fois. */
  minTotal: number;
  /** Nombre maximal d'échéances proposé (2 ou 3). */
  maxParts: 2 | 3;
  /** Écart entre deux échéances, en jours. */
  intervalDays: number;
}

export const DEFAULT_INSTALLMENTS: InstallmentSettings = { enabled: true, minTotal: 30_000, maxParts: 3, intervalDays: 15 };

export function normalizeInstallments(raw: unknown): InstallmentSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const min = Math.round(Number(r.minTotal));
  const days = Math.round(Number(r.intervalDays));
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_INSTALLMENTS.enabled,
    minTotal: Number.isFinite(min) && min >= 1_000 && min <= 5_000_000 ? min : DEFAULT_INSTALLMENTS.minTotal,
    maxParts: Number(r.maxParts) === 2 ? 2 : 3,
    intervalDays: Number.isFinite(days) && days >= 7 && days <= 45 ? days : DEFAULT_INSTALLMENTS.intervalDays,
  };
}

/** Nombres d'échéances proposés pour ce total ([] si le paiement en plusieurs fois n'est pas possible). */
export function offeredCounts(total: number, s: InstallmentSettings): number[] {
  if (!s.enabled || total < s.minTotal) return [];
  return s.maxParts === 3 ? [2, 3] : [2];
}

/** Montants des échéances : parts égales arrondies à la centaine, l'éventuel reste sur la première. */
export function splitAmounts(total: number, count: number): number[] {
  if (count < 2) return [total];
  const base = Math.floor(total / count / 100) * 100;
  return [total - base * (count - 1), ...Array.from({ length: count - 1 }, () => base)];
}

const DAY = 86_400_000;

/** Dates d'échéance : la première à la commande, puis tous les `intervalDays` jours. */
export function dueDates(start: Date, count: number, intervalDays: number): Date[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => new Date(start.getTime() + i * intervalDays * DAY));
}

export interface InstallmentOrder {
  total: number;
  createdAt: Date;
  installmentCount: number;
  installmentsPaid: number;
  installmentIntervalDays: number;
}

export const isInstallmentOrder = (o: Partial<Pick<InstallmentOrder, "installmentCount">>) => (o.installmentCount ?? 0) >= 2;

export type InstallmentLine = { n: number; amount: number; dueAt: Date; paid: boolean };

/** Échéancier complet (montant, date, payée ou non). */
export function schedule(o: InstallmentOrder): InstallmentLine[] {
  if (!isInstallmentOrder(o)) return [];
  const amounts = splitAmounts(o.total, o.installmentCount);
  const dates = dueDates(o.createdAt, o.installmentCount, o.installmentIntervalDays);
  return amounts.map((amount, i) => ({ n: i + 1, amount, dueAt: dates[i], paid: i < o.installmentsPaid }));
}

/** Prochaine échéance à payer, ou null si tout est réglé. */
export function nextInstallment(o: InstallmentOrder): (InstallmentLine & { of: number }) | null {
  const line = schedule(o).find((l) => !l.paid);
  return line ? { ...line, of: o.installmentCount } : null;
}

export const fcfa = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} F CFA`;
export const shortDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

/** Libellé court : « 3 × 10 000 F CFA » (ou « 10 100 F CFA puis 2 × 10 000 F CFA »). */
export function planLabel(total: number, count: number): string {
  const a = splitAmounts(total, count);
  if (a[0] === a[1]) return `${count} × ${fcfa(a[0])}`;
  return count === 2 ? `${fcfa(a[0])} puis ${fcfa(a[1])}` : `${fcfa(a[0])} puis ${count - 1} × ${fcfa(a[1])}`;
}

/** Rappel WhatsApp d'une échéance (avant ou le jour même). */
export function reminderVars(o: { firstName: string; n: number; of: number; amount: number; dueAt: Date; today: boolean; ref: string }) {
  return { prenom: o.firstName, numero: o.ref, echeance: `${o.n}/${o.of}`, montant: fcfa(o.amount), quand: o.today ? "aujourd'hui" : `le ${shortDate(o.dueAt)}` };
}
export function reminderText(o: Parameters<typeof reminderVars>[0]): string {
  const v = reminderVars(o);
  return `Bonjour${v.prenom ? ` ${v.prenom}` : ""} 🌸\nPetit rappel : l'échéance ${v.echeance} de votre commande JAMAAL n° ${v.numero} (${v.montant}) est à régler ${v.quand}.\nPayez en un clic avec Wave ou Orange Money grâce au bouton ci-dessous. Merci !`;
}

/** Confirmation d'une échéance intermédiaire reçue. */
export function receivedVars(o: { firstName: string; n: number; of: number; amount: number; next: { amount: number; dueAt: Date } | null; ref: string }) {
  return { prenom: o.firstName, numero: o.ref, echeance: `${o.n}/${o.of}`, montant: fcfa(o.amount), suite: o.next ? `\nProchaine échéance : ${fcfa(o.next.amount)} le ${shortDate(o.next.dueAt)}. Nous vous enverrons un rappel.` : "" };
}
export function receivedText(o: Parameters<typeof receivedVars>[0]): string {
  const v = receivedVars(o);
  return `Bonjour${v.prenom ? ` ${v.prenom}` : ""}, nous avons bien reçu l'échéance ${v.echeance} (${v.montant}) de votre commande JAMAAL n° ${v.numero}. Merci !${v.suite}`;
}
