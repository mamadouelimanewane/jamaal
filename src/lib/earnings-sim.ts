/**
 * Simulateur « Combien je peux gagner » (page Devenir consultant) : gains estimés selon le vrai barème
 * (Admin › Modèle économique). Pur, testé.
 * - Sans filleul : rang Consultant, commission vendeur sur ses ventes.
 * - Avec des filleuls : rang Parrain (dans l'équipe d'un Leader) : commission Parrain sur ses ventes, plus la part
 *   du parrain direct sur les ventes de ses filleuls, plus les primes si elles sont activées.
 */
import type { BusinessModel, PrimeTier } from "./business-model";

export const WEEKS_PER_MONTH = 52 / 12;

export type SimRates = {
  sellerPct: number;
  sellerParrainPct: number;
  sponsorPct: number;
  primesEnabled: boolean;
  primeTiers: PrimeTier[];
  teamPrimesEnabled: boolean;
  parrainTeamTiers: PrimeTier[];
  maxFilleuls: number;
};

export function simRates(m: BusinessModel): SimRates {
  return {
    sellerPct: m.sellerPct,
    sellerParrainPct: m.sellerParrainPct,
    // Le parrain direct d'un Consultant a lui-même un Leader au-dessus : part « partagée ».
    sponsorPct: m.sponsorSharedPct,
    primesEnabled: m.primesEnabled,
    primeTiers: m.primeTiers,
    teamPrimesEnabled: m.teamPrimesEnabled,
    parrainTeamTiers: m.parrainTeamTiers,
    maxFilleuls: m.maxConsultantsPerParrain > 0 ? m.maxConsultantsPerParrain : 30,
  };
}

export type SimInput = { salesPerWeek: number; basket: number; filleuls: number; filleulSalesPerWeek: number };

const tierFor = (amount: number, tiers: PrimeTier[]) => tiers.reduce<PrimeTier | null>((best, t) => (amount >= t.threshold && (!best || t.threshold > best.threshold) ? t : best), null);

export function simulateEarnings(input: SimInput, r: SimRates) {
  const sales = Math.max(0, input.salesPerWeek);
  const basket = Math.max(0, input.basket);
  const filleuls = Math.max(0, Math.min(r.maxFilleuls, Math.round(input.filleuls)));
  const parrain = filleuls > 0;
  const ownRevenue = Math.round(sales * WEEKS_PER_MONTH * basket);
  const teamRevenue = Math.round(filleuls * Math.max(0, input.filleulSalesPerWeek) * WEEKS_PER_MONTH * basket);
  const sellerRate = parrain ? r.sellerParrainPct : r.sellerPct;
  const own = Math.round((ownRevenue * sellerRate) / 100);
  const team = Math.round((teamRevenue * r.sponsorPct) / 100);
  const personalPrime = r.primesEnabled ? tierFor(ownRevenue, r.primeTiers) : null;
  const teamPrime = r.teamPrimesEnabled && parrain ? tierFor(teamRevenue, r.parrainTeamTiers) : null;
  const primes = (personalPrime?.amount ?? 0) + (teamPrime?.amount ?? 0);
  const monthly = own + team + primes;
  return { title: parrain ? ("Parrain" as const) : ("Consultant" as const), sellerRate, ownRevenue, teamRevenue, own, team, primes, personalPrime, teamPrime, monthly, yearly: monthly * 12, filleuls };
}

/** Arrondi lisible : 123 456 → 123 500. */
export const roundNice = (n: number) => (n >= 10_000 ? Math.round(n / 500) * 500 : Math.round(n / 50) * 50);
