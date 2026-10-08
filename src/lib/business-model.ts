/**
 * Modèle économique JAMAAL (reprise du classeur « jamaal-modele-marge.xlsx »).
 *
 * Fichier sans accès base : utilisable côté serveur comme dans le simulateur du navigateur.
 * Les valeurs sont enregistrées dans Setting["business_model"] (voir business-model-store.ts)
 * et modifiables dans Admin > Modèle économique.
 *
 * Base de tous les pourcentages « du prix public » : le prix public Chogan en FCFA.
 * Les commissions sont des pourcentages du prix de vente JAMAAL (hors frais de livraison).
 */

export type PrimeTier = {
  /** Ventes personnelles encaissées du mois à atteindre (FCFA). */
  threshold: number;
  /** Prime versée (FCFA). */
  amount: number;
  /** Avantage en nature éventuel (texte libre). */
  extra?: string;
};

export type BusinessModel = {
  /** Prix d'achat JAMAAL, en % du prix public Chogan. */
  purchasePct: number;
  /** Prix de vente JAMAAL, en % du prix public Chogan. */
  salePct: number;
  /** Arrondi des prix de vente (FCFA). */
  priceRounding: number;
  /** Commission du vendeur, en % du prix de vente. */
  sellerPct: number;
  /** Part du parrain direct quand personne n'est au-dessus de lui (ex. Consultant sur la vente d'un Leader). */
  sponsorAlonePct: number;
  /** Part du parrain direct quand il a lui-même un parrain (ex. Leader sur la vente d'un Parrain). */
  sponsorSharedPct: number;
  /** Part du grand-parrain (ex. Consultant sur la vente d'un Parrain). */
  grandSponsorPct: number;
  /** Expédition Italie → Dakar, en % du prix public. */
  shippingPct: number;
  /** Frais divers, en % du prix public. */
  miscPct: number;
  /** Primes mensuelles activées ? */
  primesEnabled: boolean;
  primeTiers: PrimeTier[];
  /** Bonus du 1er du classement mensuel (FCFA, 0 = aucun). */
  topSellerBonus: number;
};

export const DEFAULT_BUSINESS_MODEL: BusinessModel = {
  purchasePct: 65,
  salePct: 125,
  priceRounding: 100,
  sellerPct: 18,
  sponsorAlonePct: 6,
  sponsorSharedPct: 3,
  grandSponsorPct: 3,
  shippingPct: 10,
  miscPct: 15,
  primesEnabled: false,
  primeTiers: [
    { threshold: 75_000, amount: 5_000 },
    { threshold: 150_000, amount: 15_000 },
    { threshold: 300_000, amount: 40_000, extra: "un produit au choix" },
    { threshold: 500_000, amount: 75_000, extra: "mise en avant sur la page de la marque" },
  ],
  topSellerBonus: 25_000,
};

/** Fusionne une valeur enregistrée (éventuellement partielle ou ancienne) avec les valeurs par défaut. */
export function normalizeBusinessModel(raw: unknown): BusinessModel {
  const base = { ...DEFAULT_BUSINESS_MODEL };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const num = (key: keyof BusinessModel, min = 0, max = 1000) => {
    const v = Number(r[key]);
    if (Number.isFinite(v) && v >= min && v <= max) (base[key] as number) = v;
  };
  num("purchasePct");
  num("salePct");
  num("priceRounding", 1, 10_000);
  num("sellerPct", 0, 100);
  num("sponsorAlonePct", 0, 100);
  num("sponsorSharedPct", 0, 100);
  num("grandSponsorPct", 0, 100);
  num("shippingPct", 0, 100);
  num("miscPct", 0, 100);
  num("topSellerBonus", 0, 100_000_000);
  if (typeof r.primesEnabled === "boolean") base.primesEnabled = r.primesEnabled;
  if (Array.isArray(r.primeTiers)) {
    base.primeTiers = r.primeTiers
      .map((t) => ({
        threshold: Math.max(0, Math.round(Number((t as PrimeTier)?.threshold) || 0)),
        amount: Math.max(0, Math.round(Number((t as PrimeTier)?.amount) || 0)),
        extra: typeof (t as PrimeTier)?.extra === "string" && (t as PrimeTier).extra!.trim() ? (t as PrimeTier).extra!.trim() : undefined,
      }))
      .filter((t) => t.threshold > 0)
      .sort((a, b) => a.threshold - b.threshold);
  }
  return base;
}

/** Prix de vente JAMAAL à partir du prix public Chogan (arrondi au multiple configuré). */
export function salePriceFromPublic(publicPrice: number, model: BusinessModel): number {
  const step = model.priceRounding > 0 ? model.priceRounding : 1;
  return Math.max(step, Math.round((publicPrice * model.salePct) / 100 / step) * step);
}

/** Taux touchés par un consultant sur les ventes de son équipe, selon qu'il a lui-même un parrain. */
export function sponsorRatesFor(hasOwnSponsor: boolean, model: BusinessModel) {
  return {
    /** Sur les ventes de ses filleuls directs. */
    level1: hasOwnSponsor ? model.sponsorSharedPct : model.sponsorAlonePct,
    /** Sur les ventes des filleuls de ses filleuls. */
    level2: model.grandSponsorPct,
  };
}

export type MarginLine = { label: string; points: number; amount: number; total?: boolean };

/**
 * Décomposition de la marge pour un produit (feuille « Marge par produit »).
 * `costPct` remplace expédition + frais divers pour simuler un autre scénario.
 * `withGrandSponsor` : false = un seul parrain (part « seul »), true = parrain + grand-parrain.
 */
export function productMargin(
  publicPrice: number,
  model: BusinessModel,
  opts: { costPct?: number; withGrandSponsor?: boolean } = {}
) {
  const sale = (publicPrice * model.salePct) / 100;
  const purchase = (publicPrice * model.purchasePct) / 100;
  const sponsorPct = opts.withGrandSponsor === false ? model.sponsorAlonePct : model.sponsorSharedPct + model.grandSponsorPct;
  const seller = (sale * model.sellerPct) / 100;
  const sponsors = (sale * sponsorPct) / 100;
  const costPct = opts.costPct ?? model.shippingPct + model.miscPct;
  const costs = (publicPrice * costPct) / 100;
  const gross = sale - purchase;
  const afterCommissions = gross - seller - sponsors;
  const net = afterCommissions - costs;
  const pts = (v: number) => (publicPrice > 0 ? (v / publicPrice) * 100 : 0);

  const lines: MarginLine[] = [
    { label: "Prix de vente JAMAAL", points: pts(sale), amount: sale },
    { label: "Prix d'achat chez Chogan", points: -pts(purchase), amount: -purchase },
    { label: "Marge brute", points: pts(gross), amount: gross, total: true },
    { label: "Commission vendeur", points: -pts(seller), amount: -seller },
    { label: "Commission parrains", points: -pts(sponsors), amount: -sponsors },
    { label: "Reste après commissions", points: pts(afterCommissions), amount: afterCommissions, total: true },
    { label: "Expédition + frais divers", points: -pts(costs), amount: -costs },
    { label: "Marge nette JAMAAL", points: pts(net), amount: net, total: true },
  ];
  return {
    lines,
    sale,
    net,
    /** Marge nette en % du prix de vente. */
    netRateOfSale: sale > 0 ? net / sale : 0,
    /** Part de la marge brute absorbée par les commissions. */
    commissionShareOfGross: gross > 0 ? (seller + sponsors) / gross : 0,
  };
}

/** Palier atteint et palier suivant pour un montant de ventes personnelles encaissées. */
export function primeStatus(monthlySales: number, model: BusinessModel) {
  const tiers = model.primeTiers;
  let reached: PrimeTier | null = null;
  for (const t of tiers) if (monthlySales >= t.threshold) reached = t;
  const next = tiers.find((t) => monthlySales < t.threshold) ?? null;
  const previousThreshold = reached?.threshold ?? 0;
  const progress = next ? Math.min(100, Math.round(((monthlySales - previousThreshold) / (next.threshold - previousThreshold)) * 100)) : 100;
  return { reached, next, progress, remaining: next ? next.threshold - monthlySales : 0 };
}
