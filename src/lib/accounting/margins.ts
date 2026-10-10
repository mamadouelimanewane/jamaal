/**
 * Rentabilité des ventes d'une période : par produit, catégorie, canal, revendeur, et marge de
 * livraison. Coût d'achat théorique = prix public Chogan × part achat (modèle économique).
 * Fichier serveur.
 */
import { prisma } from "../prisma";
import { getBusinessModel } from "../business-model-store";
import { getCategories } from "../db-categories";
import { COMMISSIONABLE_ORDER } from "../commission";
import { recognitionDate } from "./posting";
import type { Period } from "./reports";

export type MarginRow = { key: string; label: string; sub?: string; qty: number; revenue: number; cost: number; commissions: number; margin: number };

type Volume = { label?: string; publicPrice?: number };

function bump(map: Map<string, MarginRow>, key: string, label: string, sub: string | undefined, v: Omit<MarginRow, "key" | "label" | "sub" | "margin">) {
  const r = map.get(key) ?? { key, label, sub, qty: 0, revenue: 0, cost: 0, commissions: 0, margin: 0 };
  r.qty += v.qty;
  r.revenue += v.revenue;
  r.cost += v.cost;
  r.commissions += v.commissions;
  r.margin = r.revenue - r.cost - r.commissions;
  map.set(key, r);
}

export async function marginReport(p: Period) {
  const [orders, model, categories] = await Promise.all([
    prisma.order.findMany({
      where: { ...COMMISSIONABLE_ORDER, createdAt: { lt: p.to } },
      select: {
        id: true, total: true, deliveryFee: true, livreurShare: true, paymentStatus: true, paymentMethod: true, status: true, paidAt: true, deliveredAt: true, updatedAt: true, createdAt: true,
        consultant: { select: { id: true, name: true } },
        items: { select: { productId: true, productName: true, volumeLabel: true, price: true, quantity: true, product: { select: { category: true, publicPrice: true, volumes: true } } } },
      },
    }),
    getBusinessModel(),
    getCategories(),
  ]);
  const inP = orders.filter((o) => {
    const d = recognitionDate({ ...o, customerName: "", isReservation: false, depositAmount: 0, depositPaidAt: null, cancelledAt: null, refundedAt: null, refundChannel: null });
    return d >= p.from && d < p.to;
  });
  const ids = inP.map((o) => o.id);
  const [commissions, refunds] = await Promise.all([
    ids.length ? prisma.commissionEntry.groupBy({ by: ["orderId"], where: { orderId: { in: ids }, status: { not: "ANNULE" } }, _sum: { amount: true } }) : [],
    ids.length ? prisma.return.groupBy({ by: ["orderId"], where: { orderId: { in: ids }, status: "REMBOURSE" }, _sum: { amount: true } }) : [],
  ]);
  const comOf = new Map(commissions.map((c) => [c.orderId, c._sum.amount ?? 0]));
  const refOf = new Map(refunds.map((r) => [r.orderId, r._sum.amount ?? 0]));
  const catLabel = new Map(categories.map((c) => [c.slug as string, c.navLabel.replace("JAMAAL ", "")]));

  const byProduct = new Map<string, MarginRow>();
  const byCategory = new Map<string, MarginRow>();
  const byChannel = new Map<string, MarginRow>();
  const bySeller = new Map<string, MarginRow>();
  let deliveryBilled = 0, livreurShares = 0, refundsTotal = 0, estimatedCost = 0;

  for (const o of inP) {
    const itemsSum = o.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const products = Math.max(0, o.total - o.deliveryFee);
    const refund = refOf.get(o.id) ?? 0;
    refundsTotal += refund;
    const net = Math.max(0, products - refund);
    const factor = itemsSum > 0 ? net / itemsSum : 0; // remises et retours répartis sur les articles
    const com = comOf.get(o.id) ?? 0;
    deliveryBilled += Math.min(o.total, o.deliveryFee);
    livreurShares += o.livreurShare;
    const channel = o.consultant ? "Réseau de revendeurs" : "Boutique en ligne (vente directe)";
    for (const i of o.items) {
      const revenue = Math.round(i.price * i.quantity * factor);
      const vols = (Array.isArray(i.product?.volumes) ? i.product.volumes : []) as Volume[];
      const pub = vols.find((v) => v.label === i.volumeLabel)?.publicPrice ?? (vols.length <= 1 ? i.product?.publicPrice : null);
      let unit: number;
      if (pub) unit = Math.round((pub * model.purchasePct) / 100);
      else {
        unit = model.salePct > 0 ? Math.round((i.price * model.purchasePct) / model.salePct) : 0;
        estimatedCost++;
      }
      const cost = unit * i.quantity;
      const commissions = itemsSum > 0 ? Math.round((com * i.price * i.quantity) / itemsSum) : 0;
      const v = { qty: i.quantity, revenue, cost, commissions };
      const cat = i.product?.category ?? "autre";
      bump(byProduct, `${i.productId ?? i.productName}:${i.volumeLabel}`, i.productName, i.volumeLabel, v);
      bump(byCategory, cat, catLabel.get(cat) ?? cat, undefined, v);
      bump(byChannel, channel, channel, undefined, v);
      if (o.consultant) bump(bySeller, o.consultant.id, o.consultant.name, undefined, v);
    }
  }
  const sort = (m: Map<string, MarginRow>) => [...m.values()].sort((a, b) => b.revenue - a.revenue);
  const all = [...byChannel.values()];
  const totals = {
    orders: inP.length,
    revenue: all.reduce((s, r) => s + r.revenue, 0),
    cost: all.reduce((s, r) => s + r.cost, 0),
    commissions: all.reduce((s, r) => s + r.commissions, 0),
    margin: all.reduce((s, r) => s + r.margin, 0),
  };
  return {
    totals,
    products: sort(byProduct),
    categories: sort(byCategory),
    channels: sort(byChannel),
    sellers: sort(bySeller),
    delivery: { billed: deliveryBilled, livreurs: livreurShares, margin: deliveryBilled - livreurShares },
    refunds: refundsTotal,
    estimatedCost,
    purchasePct: model.purchasePct,
  };
}
