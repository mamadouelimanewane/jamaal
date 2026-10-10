/**
 * Génération des écritures comptables (partie double) à partir des opérations de JAMAAL :
 * commandes, acomptes, retours, wallets, commissions, dépenses, stocks, saisies manuelles.
 * Pur : reçoit des objets simples, rend des écritures équilibrées. Testé dans __tests__.
 *
 * Règles retenues (documentées dans Admin › Comptabilité › Réglages) :
 * - Vente constatée quand la commande est payée, ou livrée si elle est payée à la livraison
 *   (même règle que les commissions) ; une commande annulée n'est pas une vente.
 * - Tout encaissement client passe par le compte 411 : un solde créditeur = avance du client
 *   (acompte de réservation, commande payée pas encore annulée/remboursée).
 * - Les wallets des revendeurs et livreurs sont des dettes de JAMAAL (4671 / 4672).
 * - Coût des ventes par variation de stock (inventaire valorisé au prix d'achat Chogan).
 */
import { channelAccount, LEGACY_CATEGORY_ACCOUNT, paymentMethodAccount, walletProviderAccount } from "./chart";

export type Line = { account: string; debit: number; credit: number; label?: string; aux?: string };
export type SourceType = "COMMANDE" | "RETOUR" | "WALLET" | "COMMISSION" | "LIVREUR" | "VERSEMENT" | "DEPENSE" | "MANUELLE" | "STOCK";
export type Entry = {
  id: string;
  date: Date;
  journal: string;
  label: string;
  ref?: string;
  source: { type: SourceType; id: string; href?: string };
  lines: Line[];
  /** Numéro de pièce attribué après tri (VE-2026-00001). */
  num?: string;
};

export type PostingSettings = {
  vatEnabled: boolean;
  vatRate: number;
  /** Frais des prestataires de paiement, en % de l'encaissement. */
  fees: { WAVE: number; ORANGE_MONEY: number; STRIPE: number };
  /** DEPENSES : les achats Chogan sont saisis en dépenses (601). RECEPTIONS : achats constatés à la réception du stock. */
  purchaseMode: "DEPENSES" | "RECEPTIONS";
};

export const DEFAULT_POSTING: PostingSettings = { vatEnabled: false, vatRate: 18, fees: { WAVE: 0, ORANGE_MONEY: 0, STRIPE: 0 }, purchaseMode: "DEPENSES" };

// ---------- Outils ----------

/** Part de TVA comprise dans un montant TTC. */
export function vatOf(ttc: number, rate: number): number {
  if (!rate || ttc === 0) return 0;
  return ttc - Math.round(ttc / (1 + rate / 100));
}

const shortId = (id: string) => id.slice(-8).toUpperCase();

function make(e: Omit<Entry, "lines"> & { lines: Line[] }): Entry | null {
  const lines = e.lines
    .map((l) => ({ ...l, debit: Math.round(l.debit), credit: Math.round(l.credit) }))
    .map((l) => (l.debit < 0 || l.credit < 0 ? { ...l, debit: Math.max(0, l.debit) + Math.max(0, -l.credit), credit: Math.max(0, l.credit) + Math.max(0, -l.debit) } : l))
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  if (!lines.length) return null;
  return { ...e, lines };
}

const D = (account: string, amount: number, extra: Partial<Line> = {}): Line => ({ account, debit: amount, credit: 0, ...extra });
const C = (account: string, amount: number, extra: Partial<Line> = {}): Line => ({ account, debit: 0, credit: amount, ...extra });

export function isBalanced(e: Pick<Entry, "lines">): boolean {
  const d = e.lines.reduce((s, l) => s + l.debit, 0);
  const c = e.lines.reduce((s, l) => s + l.credit, 0);
  return d === c;
}

function feeFor(method: string, amount: number, s: PostingSettings): number {
  const pct = method === "WAVE" ? s.fees.WAVE : method === "ORANGE_MONEY" ? s.fees.ORANGE_MONEY : method === "STRIPE" ? s.fees.STRIPE : 0;
  return pct > 0 ? Math.round((amount * pct) / 100) : 0;
}

/** Encaissement client : trésorerie (moins les frais du prestataire) au débit, 411 au crédit. */
function receipt(id: string, date: Date, method: string, amount: number, aux: string, label: string, orderId: string, s: PostingSettings): Entry | null {
  const cash = paymentMethodAccount(method) ?? "571";
  const fee = feeFor(method, amount, s);
  return make({
    id,
    date,
    journal: "BQ",
    label,
    ref: `#${shortId(orderId)}`,
    source: { type: "COMMANDE", id: orderId, href: `/admin/commandes/${orderId}` },
    lines: [D(cash, amount - fee), D("631", fee, { label: "Frais du prestataire de paiement" }), C("411", amount, { aux })],
  });
}

// ---------- Commandes ----------

export type OrderInput = {
  id: string;
  customerName: string;
  total: number;
  deliveryFee: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  paidAt: Date | null;
  deliveredAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  isReservation: boolean;
  depositAmount: number;
  depositPaidAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  refundChannel: string | null;
};

/** La commande compte comme une vente (même règle que les commissions). */
export function isRecognized(o: Pick<OrderInput, "status" | "paymentStatus" | "paymentMethod">) {
  return o.status !== "ANNULEE" && (o.paymentStatus === "PAYE" || (o.paymentMethod === "A_LA_LIVRAISON" && o.status === "LIVREE"));
}

export function recognitionDate(o: OrderInput): Date {
  return o.paymentStatus === "PAYE" ? (o.paidAt ?? o.updatedAt) : (o.deliveredAt ?? o.updatedAt);
}

/** Montant déjà encaissé auprès du client hors wallet (acompte + paiement). */
export function cashReceived(o: OrderInput): number {
  const deposit = o.isReservation && o.depositPaidAt ? o.depositAmount : 0;
  const main = o.paymentStatus === "PAYE" && o.paymentMethod !== "WALLET" ? o.total - deposit : 0;
  return deposit + Math.max(0, main);
}

export function postOrder(o: OrderInput, s: PostingSettings): Entry[] {
  const out: (Entry | null)[] = [];
  const aux = o.customerName;
  const ref = `#${shortId(o.id)}`;
  const source = { type: "COMMANDE" as const, id: o.id, href: `/admin/commandes/${o.id}` };
  const deposit = o.isReservation && o.depositPaidAt ? o.depositAmount : 0;

  // 1. Acompte de réservation
  if (deposit > 0 && o.depositPaidAt) {
    out.push(receipt(`ACP-${o.id}`, o.depositPaidAt, o.paymentMethod, deposit, aux, `Acompte de réservation ${aux}`, o.id, s));
  }

  // 2. Vente
  const recognized = isRecognized(o);
  if (recognized) {
    const R = recognitionDate(o);
    const products = Math.max(0, o.total - o.deliveryFee);
    const delivery = Math.min(o.total, o.deliveryFee);
    const rate = s.vatEnabled ? s.vatRate : 0;
    const vatP = vatOf(products, rate);
    const vatD = vatOf(delivery, rate);
    out.push(
      make({
        id: `VE-${o.id}`,
        date: R,
        journal: "VE",
        label: `Vente ${aux}`,
        ref,
        source,
        lines: [D("411", o.total, { aux }), C("701", products - vatP), C("7071", delivery - vatD), C("4431", vatP + vatD)],
      })
    );
    // 3. Paiement du solde (le paiement par wallet est passé avec le mouvement du wallet)
    const rest = o.total - deposit;
    if (rest > 0) {
      if (o.paymentStatus === "PAYE" && o.paymentMethod !== "WALLET") {
        out.push(receipt(`ENC-${o.id}`, o.paidAt ?? R, o.paymentMethod, rest, aux, `Encaissement ${aux}`, o.id, s));
      } else if (o.paymentStatus !== "PAYE") {
        out.push(receipt(`ENC-${o.id}`, R, "A_LA_LIVRAISON", rest, aux, `Encaissement à la livraison ${aux}`, o.id, s));
      }
    }
  } else if (o.status === "ANNULEE" && o.paymentStatus === "PAYE" && o.paymentMethod !== "WALLET") {
    // Payée puis annulée : l'argent a bien été reçu, il reste dû au client (411 créditeur).
    const rest = o.total - deposit;
    if (rest > 0) out.push(receipt(`ENC-${o.id}`, o.paidAt ?? o.updatedAt, o.paymentMethod, rest, aux, `Encaissement ${aux} (commande annulée)`, o.id, s));
  }

  // 4. Remboursement d'une commande annulée, ou acompte conservé
  if (!recognized && o.status === "ANNULEE" && o.refundedAt) {
    const owed = cashReceived(o) + (o.paymentMethod === "WALLET" && o.paymentStatus === "PAYE" ? o.total : 0);
    if (owed > 0) {
      const kept = o.refundChannel === "CONSERVE";
      out.push(
        make({
          id: `RMB-${o.id}`,
          date: o.refundedAt,
          journal: kept ? "OD" : "BQ",
          label: kept ? `Acompte conservé ${aux}` : `Remboursement ${aux} (commande annulée)`,
          ref,
          source,
          lines: [D("411", owed, { aux }), C(kept ? "758" : channelAccount(o.refundChannel), owed)],
        })
      );
    }
  }
  return out.filter((e): e is Entry => !!e);
}

// ---------- Retours remboursés ----------

export type ReturnInput = { id: string; orderId: string; amount: number; date: Date; customerName: string; paymentMethod: string; reason: string };

export function postReturn(r: ReturnInput, s: PostingSettings): Entry | null {
  const vat = vatOf(r.amount, s.vatEnabled ? s.vatRate : 0);
  return make({
    id: `RET-${r.id}`,
    date: r.date,
    journal: "VE",
    label: `Retour remboursé ${r.customerName}`,
    ref: `#${shortId(r.orderId)}`,
    source: { type: "RETOUR", id: r.id, href: `/admin/retours` },
    lines: [D("7019", r.amount - vat, { label: r.reason.slice(0, 60) }), D("4431", vat), C(paymentMethodAccount(r.paymentMethod) ?? "571", r.amount)],
  });
}

// ---------- Wallets ----------

export type WalletTxInput = {
  id: string;
  ownerType: string;
  ownerName: string;
  amount: number;
  kind: string;
  status: string;
  provider: string | null;
  orderId: string | null;
  customerName?: string | null;
  note: string | null;
  date: Date;
};

export const memberAccount = (ownerType: string) => (ownerType === "LIVREUR" ? "4672" : "4671");

export function postWalletTx(t: WalletTxInput): Entry | null {
  if (t.status !== "VALIDE" || t.amount === 0) return null;
  const m = memberAccount(t.ownerType);
  const aux = t.ownerName;
  const a = Math.abs(t.amount);
  const base = { id: `W-${t.id}`, date: t.date, ref: t.orderId && !t.orderId.startsWith("PRIME") ? `#${shortId(t.orderId)}` : undefined, source: { type: "WALLET" as const, id: t.id, href: "/admin/wallets" } };
  const charge = t.ownerType === "LIVREUR" ? "612" : "6322";
  switch (t.kind) {
    case "COMMISSION":
    case "PRIME":
    case "LIVRAISON":
      return make({ ...base, journal: "RE", label: `${t.kind === "PRIME" ? "Prime" : t.kind === "LIVRAISON" ? "Part de livraison" : "Commission"} ${aux}`, lines: t.amount > 0 ? [D(t.kind === "LIVRAISON" ? "612" : "6322", a), C(m, a, { aux })] : [D(m, a, { aux }), C(charge, a)] });
    case "ANNULATION":
      return make({ ...base, journal: "RE", label: `Annulation de gain ${aux}`, lines: t.amount < 0 ? [D(m, a, { aux }), C(charge, a)] : [D(charge, a), C(m, a, { aux })] });
    case "DEPOT":
      return make({ ...base, journal: "BQ", label: `Dépôt sur wallet ${aux}`, lines: [D(walletProviderAccount(t.provider), a), C(m, a, { aux })] });
    case "RETRAIT":
      return make({ ...base, journal: "BQ", label: `Retrait wallet ${aux}`, lines: [D(m, a, { aux }), C(walletProviderAccount(t.provider), a)] });
    case "PAIEMENT":
      return make({ ...base, journal: "BQ", label: `Commande payée avec le wallet de ${aux}`, lines: [D(m, a, { aux }), C("411", a, { aux: t.customerName ?? aux })] });
    default:
      return make({ ...base, journal: "OD", label: `Ajustement wallet ${aux}${t.note ? ` : ${t.note}` : ""}`.slice(0, 120), lines: t.amount > 0 ? [D("658", a), C(m, a, { aux })] : [D(m, a, { aux }), C("758", a)] });
  }
}

// ---------- Avant le wallet : commissions et parts de livraison ----------

export type CommissionInput = { id: string; consultantName: string; amount: number; status: string; level: string; orderId: string; date: Date };

/** Commission enregistrée hors wallet (versée par l'ancien système ou pas encore créditée). */
export function postCommissionEntry(e: CommissionInput): Entry | null {
  if (e.status === "ANNULE" || e.status === "WALLET" || e.amount <= 0) return null;
  const prime = e.level.startsWith("PRIME");
  return make({
    id: `COM-${e.id}`,
    date: e.date,
    journal: "RE",
    label: `${prime ? "Prime d'équipe" : "Commission"} ${e.consultantName}`,
    ref: prime ? e.orderId : `#${shortId(e.orderId)}`,
    source: { type: "COMMISSION", id: e.id, href: prime ? "/admin/primes-equipe" : `/admin/commandes/${e.orderId}` },
    lines: [D("6322", e.amount), C("4671", e.amount, { aux: e.consultantName })],
  });
}

export type LivreurEarningInput = { id: string; livreurName: string; amount: number; status: string; provider: string | null; orderId: string; createdAt: Date; updatedAt: Date };

export function postLivreurEarning(e: LivreurEarningInput): Entry[] {
  if (e.status === "ANNULE" || e.status === "WALLET" || e.amount <= 0) return [];
  const out = [
    make({ id: `LIV-${e.id}`, date: e.createdAt, journal: "RE", label: `Part de livraison ${e.livreurName}`, ref: `#${shortId(e.orderId)}`, source: { type: "LIVREUR", id: e.id, href: `/admin/commandes/${e.orderId}` }, lines: [D("612", e.amount), C("4672", e.amount, { aux: e.livreurName })] }),
  ];
  if (e.status === "VERSE") {
    out.push(make({ id: `LIVP-${e.id}`, date: e.updatedAt, journal: "BQ", label: `Versement livreur ${e.livreurName}`, ref: `#${shortId(e.orderId)}`, source: { type: "LIVREUR", id: e.id, href: "/admin/livreurs" }, lines: [D("4672", e.amount, { aux: e.livreurName }), C(walletProviderAccount(e.provider), e.amount)] }));
  }
  return out.filter((x): x is Entry => !!x);
}

export type CommissionPaymentInput = { id: string; consultantName: string; amount: number; label: string; note: string | null; date: Date };

/** Versement de commissions de l'ancien système (avant le wallet). */
export function postCommissionPayment(p: CommissionPaymentInput): Entry | null {
  const text = `${p.label} ${p.note ?? ""}`;
  const cash = /orange/i.test(text) ? "5522" : /wave/i.test(text) ? "5521" : "571";
  return make({
    id: `VCP-${p.id}`,
    date: p.date,
    journal: "BQ",
    label: `Versement de commissions ${p.consultantName}`,
    ref: p.label.slice(0, 40),
    source: { type: "VERSEMENT", id: p.id, href: "/admin/versements" },
    lines: [D("4671", p.amount, { aux: p.consultantName }), C(cash, p.amount)],
  });
}

// ---------- Dépenses ----------

export type ExpenseInput = {
  id: string;
  label: string;
  amount: number;
  vatAmount: number;
  account: string | null;
  category: string;
  channel: string;
  supplier: string | null;
  reference: string | null;
  paid: boolean;
  paidAt: Date | null;
  date: Date;
};

export function expenseAccount(e: Pick<ExpenseInput, "account" | "category">, s: Pick<PostingSettings, "purchaseMode">): string {
  const acc = e.account || LEGACY_CATEGORY_ACCOUNT[e.category] || "638";
  // Achats constatés à la réception du stock : la dépense « achat de marchandises » règle le fournisseur.
  return acc === "601" && s.purchaseMode === "RECEPTIONS" ? "401" : acc;
}

const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

export function postExpense(e: ExpenseInput, s: PostingSettings): Entry[] {
  const acc = expenseAccount(e, s);
  const aux = e.supplier || undefined;
  const source = { type: "DEPENSE" as const, id: e.id, href: `/admin/comptabilite/depenses?modifier=${e.id}` };
  const cash = channelAccount(e.channel);
  const ref = e.reference || undefined;
  // Règlement d'un tiers (fournisseur, salaire dû, impôt…) : pas de charge, pas de TVA.
  if (/^[14]/.test(acc)) {
    const at = e.paidAt ?? e.date;
    return [make({ id: `DEP-${e.id}`, date: at, journal: "BQ", label: e.label, ref, source, lines: [D(acc, e.amount, { aux }), C(cash, e.amount)] })].filter((x): x is Entry => !!x);
  }
  const vat = s.vatEnabled ? Math.max(0, Math.min(e.amount, e.vatAmount)) : 0;
  const direct = e.paid && (!e.paidAt || sameDay(e.paidAt, e.date));
  const out = [
    make({ id: `DEP-${e.id}`, date: e.date, journal: "AC", label: e.label, ref, source, lines: [D(acc, e.amount - vat, { aux }), D("4452", vat), direct ? C(cash, e.amount) : C("401", e.amount, { aux: aux ?? e.label.slice(0, 40) })] }),
  ];
  if (!direct && e.paid && e.paidAt) {
    out.push(make({ id: `DEPR-${e.id}`, date: e.paidAt, journal: "BQ", label: `Règlement : ${e.label}`, ref, source, lines: [D("401", e.amount, { aux: aux ?? e.label.slice(0, 40) }), C(cash, e.amount)] }));
  }
  return out.filter((x): x is Entry => !!x);
}

// ---------- Saisies manuelles ----------

export type ManualInput = { id: string; date: Date; journal: string; label: string; reference: string | null; lines: Line[] };

export function postManual(m: ManualInput): Entry | null {
  return make({ id: `OD-${m.id}`, date: m.date, journal: m.journal || "OD", label: m.label, ref: m.reference ?? undefined, source: { type: "MANUELLE", id: m.id, href: `/admin/comptabilite/journal/saisie?id=${m.id}` }, lines: m.lines });
}

/** Lignes d'une saisie manuelle lues depuis la base (JSON) : nettoyées, montants entiers. */
export function parseLines(raw: unknown): Line[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
    .map((r) => ({
      account: String(r.account ?? "").trim(),
      label: r.label ? String(r.label).slice(0, 120) : undefined,
      aux: r.aux ? String(r.aux).slice(0, 80) : undefined,
      debit: Math.max(0, Math.round(Number(r.debit) || 0)),
      credit: Math.max(0, Math.round(Number(r.credit) || 0)),
    }))
    .filter((l) => l.account && (l.debit || l.credit));
}

// ---------- Stocks ----------

/** Stock d'ouverture (à la date de début de la comptabilité), apporté par l'exploitant. */
export function postOpeningStock(date: Date, value: number): Entry | null {
  if (value <= 0) return null;
  return make({ id: `AN-STOCK`, date, journal: "AN", label: "Stock d'ouverture (valeur d'achat)", source: { type: "STOCK", id: "ouverture", href: "/admin/stocks" }, lines: [D("311", value), C("104", value)] });
}

/** Variation de stock d'un mois : stock final − stock initial (valeur d'achat). */
export function postStockVariation(month: string, date: Date, variation: number): Entry | null {
  if (!variation) return null;
  const a = Math.abs(variation);
  return make({
    id: `ST-${month}`,
    date,
    journal: "ST",
    label: `Variation de stock ${month}`,
    source: { type: "STOCK", id: month, href: "/admin/stocks" },
    lines: variation > 0 ? [D("311", a), C("6031", a)] : [D("6031", a), C("311", a)],
  });
}

export type ReceptionInput = { id: string; date: Date; quantity: number; unitCost: number; label: string; reference: string | null };

/** Achat constaté à la réception du stock (mode RECEPTIONS) : dette envers Chogan. */
export function postReception(r: ReceptionInput): Entry | null {
  const v = Math.round(r.quantity * r.unitCost);
  if (v <= 0) return null;
  return make({ id: `REC-${r.id}`, date: r.date, journal: "AC", label: `Réception ${r.label}`, ref: r.reference ?? undefined, source: { type: "STOCK", id: r.id, href: "/admin/stocks/mouvements" }, lines: [D("601", v), C("401", v, { aux: "Chogan" })] });
}

// ---------- Numérotation ----------

/** Trie les écritures et leur attribue un numéro de pièce par journal et par année. */
export function numberEntries(entries: Entry[]): Entry[] {
  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  const counters = new Map<string, number>();
  for (const e of sorted) {
    const k = `${e.journal}-${e.date.getUTCFullYear()}`;
    const n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    e.num = `${k}-${String(n).padStart(5, "0")}`;
  }
  return sorted;
}
