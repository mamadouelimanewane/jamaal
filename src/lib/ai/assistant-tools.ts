/**
 * Outils de l'assistant IA du back-office : chaque outil lit la base pour répondre à une question
 * (catalogue, stock, commandes, clients, revendeurs…). Les données sont filtrées selon le rôle :
 * - ADMIN : tout ;
 * - CONSULTANT : catalogue et stock, plus ses propres commandes, clients et ventes ;
 * - LIVREUR : catalogue et stock, plus les commandes qui lui sont confiées.
 * Aucun outil n'écrit en base : l'assistant ne fait que consulter.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchCatalog } from "@/lib/search-index";
import { getStockRows, type StockRow } from "@/lib/inventory-report";
import type { GeminiFunctionDeclaration } from "./gemini";

export interface AssistantScope {
  role: "ADMIN" | "CONSULTANT" | "LIVREUR";
  userId: string;
  consultantId: string | null;
  livreurId: string | null;
}

type Args = Record<string, unknown>;

interface ToolDef {
  declaration: GeminiFunctionDeclaration;
  roles: AssistantScope["role"][];
  run: (args: Args, scope: AssistantScope) => Promise<unknown>;
}

const DAY_MS = 86_400_000;
const ORDER_STATUSES = ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE", "LIVREE", "ANNULEE"] as const;
const PAYMENT_STATUSES = ["EN_ATTENTE", "PAYE", "ECHOUE"] as const;
const MOVEMENT_KINDS = ["VENTE", "ANNULATION", "RECEPTION", "INVENTAIRE", "PERTE", "RETOUR", "AJUSTEMENT"] as const;

function str(v: unknown, max = 100): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function int(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
}

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | undefined {
  const s = str(v).toUpperCase();
  return (list as readonly string[]).includes(s) ? (s as T) : undefined;
}

function since(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

/** Filtre des commandes visibles par l'utilisateur. */
export function orderScope(scope: AssistantScope): Prisma.OrderWhereInput {
  if (scope.role === "ADMIN") return {};
  if (scope.role === "CONSULTANT") return { consultantId: scope.consultantId ?? "__aucun__" };
  return { livreurId: scope.livreurId ?? "__aucun__" };
}

function stockLine(r: StockRow, admin: boolean) {
  return {
    format: r.format,
    code: r.code,
    stock: r.stock,
    seuil: r.threshold,
    statut: r.status,
    prixVente: r.salePrice,
    ventes30j: r.sold30,
    ...(admin ? { aCommander: r.toOrder, couvertureJours: r.coverageDays, coutUnitaire: r.unitCost } : {}),
  };
}

const TOOLS: Record<string, ToolDef> = {
  rechercher_produits: {
    roles: ["ADMIN", "CONSULTANT", "LIVREUR"],
    declaration: {
      name: "rechercher_produits",
      description:
        "Recherche dans le catalogue (nom, code Chogan, parfum de marque dont il s'inspire, notes olfactives, catégorie) et renvoie le stock de chaque format. À utiliser pour toute question sur un produit, un parfum « comme Sauvage », un code (001M, BSF016…) ou la disponibilité.",
      parameters: {
        type: "object",
        properties: {
          requete: { type: "string", description: "Mots-clés : nom, code, marque, note, catégorie…" },
          limite: { type: "integer", description: "Nombre de produits (1 à 15, défaut 8)" },
        },
        required: ["requete"],
      },
    },
    run: async (args, scope) => {
      const q = str(args.requete, 80);
      if (!q) return { erreur: "requête vide" };
      const limit = int(args.limite, 8, 1, 15);
      const [found, rows] = await Promise.all([searchCatalog(q, limit), getStockRows()]);
      const byProduct = new Map<string, StockRow[]>();
      for (const r of rows) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
      const admin = scope.role === "ADMIN";
      return {
        requeteComprise: found.corrected ?? found.query,
        total: found.total,
        produits: found.hits.slice(0, limit).map(({ doc }) => ({
          nom: doc.name,
          code: doc.choganCode,
          inspireDe: doc.inspiredBy ? `${doc.inspiredBy}${doc.inspiredBrand ? ` (${doc.inspiredBrand})` : ""}` : null,
          categorie: doc.categoryLabel,
          famille: doc.family,
          notes: doc.notes.slice(0, 8),
          prixAPartirDe: doc.price,
          stockTotal: (byProduct.get(doc.id) ?? []).reduce((s, r) => s + r.stock, 0),
          formats: (byProduct.get(doc.id) ?? []).map((r) => stockLine(r, admin)),
          lienBoutique: `/produits/${doc.slug}`,
          ...(admin ? { lienAdmin: `/admin/produits/${doc.id}/modifier` } : {}),
        })),
      };
    },
  },

  etat_stock: {
    roles: ["ADMIN", "CONSULTANT", "LIVREUR"],
    declaration: {
      name: "etat_stock",
      description:
        "État du stock par format : ruptures, stocks bas, quantités à commander chez Chogan, totaux. À utiliser pour « qu'est-ce qui est en rupture ? », « que dois-je commander ? », « valeur du stock ».",
      parameters: {
        type: "object",
        properties: {
          filtre: {
            type: "string",
            enum: ["rupture", "bas", "a_commander", "tous"],
            description: "rupture = stock 0 ; bas = sous le seuil ; a_commander = quantité conseillée > 0",
          },
          categorie: { type: "string", description: "Catégorie (slug ou libellé), facultatif" },
          limite: { type: "integer", description: "Nombre de lignes (1 à 40, défaut 20)" },
        },
      },
    },
    run: async (args, scope) => {
      const filtre = str(args.filtre) || "tous";
      const cat = str(args.categorie).toLowerCase();
      const limit = int(args.limite, 20, 1, 40);
      const admin = scope.role === "ADMIN";
      const all = await getStockRows();
      let rows = all;
      if (cat) rows = rows.filter((r) => r.category.toLowerCase().includes(cat) || r.categoryLabel.toLowerCase().includes(cat));
      if (filtre === "rupture") rows = rows.filter((r) => r.status === "rupture");
      else if (filtre === "bas") rows = rows.filter((r) => r.status === "bas");
      else if (filtre === "a_commander") rows = rows.filter((r) => r.toOrder > 0);
      rows = [...rows].sort((a, b) => b.sold30 - a.sold30 || a.stock - b.stock);
      return {
        totaux: {
          formats: all.length,
          enRupture: all.filter((r) => r.status === "rupture").length,
          stockBas: all.filter((r) => r.status === "bas").length,
          unites: all.reduce((s, r) => s + r.stock, 0),
          ...(admin ? { valeurAuCout: all.reduce((s, r) => s + r.stock * (r.unitCost ?? 0), 0) } : {}),
        },
        lignesCorrespondantes: rows.length,
        lignes: rows.slice(0, limit).map((r) => ({ produit: r.name, categorie: r.categoryLabel, ...stockLine(r, admin) })),
      };
    },
  },

  mouvements_stock: {
    roles: ["ADMIN"],
    declaration: {
      name: "mouvements_stock",
      description: "Historique des entrées et sorties de stock (ventes, réceptions Chogan, inventaires, pertes, retours).",
      parameters: {
        type: "object",
        properties: {
          produit: { type: "string", description: "Nom ou code du produit, facultatif" },
          type: { type: "string", enum: [...MOVEMENT_KINDS] },
          jours: { type: "integer", description: "Période en jours (défaut 30, max 365)" },
          limite: { type: "integer", description: "1 à 40, défaut 20" },
        },
      },
    },
    run: async (args) => {
      const produit = str(args.produit);
      const kind = oneOf(args.type, MOVEMENT_KINDS);
      const where: Prisma.StockMovementWhereInput = {
        createdAt: { gte: since(int(args.jours, 30, 1, 365)) },
        ...(kind ? { kind } : {}),
        ...(produit
          ? { product: { OR: [{ name: { contains: produit, mode: "insensitive" } }, { choganCode: { equals: produit, mode: "insensitive" } }] } }
          : {}),
      };
      const [rows, byKind] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: int(args.limite, 20, 1, 40),
          select: {
            createdAt: true, kind: true, delta: true, nextStock: true, reason: true, reference: true, orderId: true,
            product: { select: { name: true } }, variant: { select: { volumeLabel: true } }, user: { select: { name: true } },
          },
        }),
        prisma.stockMovement.groupBy({ by: ["kind"], where, _sum: { delta: true }, _count: { _all: true } }),
      ]);
      return {
        parType: byKind.map((k) => ({ type: k.kind, mouvements: k._count._all, quantite: k._sum.delta ?? 0 })),
        mouvements: rows.map((m) => ({
          date: m.createdAt.toISOString().slice(0, 16).replace("T", " "),
          produit: m.product.name,
          format: m.variant?.volumeLabel ?? null,
          type: m.kind,
          quantite: m.delta,
          stockApres: m.nextStock,
          motif: m.reason,
          reference: m.reference,
          par: m.user?.name ?? null,
          commande: m.orderId ? `/admin/commandes/${m.orderId}` : null,
        })),
      };
    },
  },

  chercher_commandes: {
    roles: ["ADMIN", "CONSULTANT", "LIVREUR"],
    declaration: {
      name: "chercher_commandes",
      description:
        "Recherche des commandes (nom ou téléphone du client, numéro de commande, produit) avec filtres de statut, de paiement et de période. Le revendeur ne voit que ses commandes, le livreur celles qui lui sont confiées.",
      parameters: {
        type: "object",
        properties: {
          requete: { type: "string", description: "Client, téléphone, numéro de commande ou produit, facultatif" },
          statut: { type: "string", enum: [...ORDER_STATUSES] },
          paiement: { type: "string", enum: [...PAYMENT_STATUSES] },
          jours: { type: "integer", description: "Commandes des N derniers jours (défaut 90, max 730)" },
          limite: { type: "integer", description: "1 à 25, défaut 10" },
        },
      },
    },
    run: async (args, scope) => {
      const q = str(args.requete);
      const statut = oneOf(args.statut, ORDER_STATUSES);
      const paiement = oneOf(args.paiement, PAYMENT_STATUSES);
      const where: Prisma.OrderWhereInput = {
        AND: [
          orderScope(scope),
          { createdAt: { gte: since(int(args.jours, 90, 1, 730)) } },
          statut ? { status: statut } : {},
          paiement ? { paymentStatus: paiement } : {},
          q
            ? {
                OR: [
                  { customerName: { contains: q, mode: "insensitive" } },
                  { customerPhone: { contains: q.replace(/\s/g, "") } },
                  { id: { contains: q, mode: "insensitive" } },
                  { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
                ],
              }
            : {},
        ],
      };
      const [count, sum, orders] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.aggregate({ where, _sum: { total: true } }),
        prisma.order.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: int(args.limite, 10, 1, 25),
          select: {
            id: true, createdAt: true, customerName: true, customerPhone: true, total: true, status: true,
            paymentStatus: true, paymentMethod: true, deliveryStatus: true, isReservation: true,
            consultant: { select: { name: true } },
            items: { select: { productName: true, volumeLabel: true, quantity: true } },
          },
        }),
      ]);
      const base = scope.role === "ADMIN" ? "/admin/commandes" : scope.role === "CONSULTANT" ? "/admin/mes-commandes" : "/admin/mes-livraisons";
      return {
        nombre: count,
        montantTotal: sum._sum.total ?? 0,
        commandes: orders.map((o) => ({
          numero: o.id.slice(-8).toUpperCase(),
          date: o.createdAt.toISOString().slice(0, 10),
          client: o.customerName,
          telephone: o.customerPhone,
          total: o.total,
          statut: o.status,
          paiement: `${o.paymentMethod} · ${o.paymentStatus}`,
          livraison: o.deliveryStatus,
          reservation: o.isReservation,
          ...(scope.role === "ADMIN" ? { revendeur: o.consultant?.name ?? null } : {}),
          articles: o.items.map((i) => `${i.quantity} × ${i.productName} (${i.volumeLabel})`),
          lien: scope.role === "LIVREUR" ? base : `${base}/${o.id}`,
        })),
      };
    },
  },

  resume_ventes: {
    roles: ["ADMIN", "CONSULTANT"],
    declaration: {
      name: "resume_ventes",
      description:
        "Chiffre d'affaires, nombre de commandes, panier moyen, répartition par statut et meilleurs produits sur une période. Pour le revendeur : ses propres ventes.",
      parameters: {
        type: "object",
        properties: { jours: { type: "integer", description: "Période en jours (défaut 30, max 730)" } },
      },
    },
    run: async (args, scope) => {
      const days = int(args.jours, 30, 1, 730);
      const where: Prisma.OrderWhereInput = { AND: [orderScope(scope), { createdAt: { gte: since(days) } }] };
      const valid: Prisma.OrderWhereInput = { AND: [where, { status: { not: "ANNULEE" } }] };
      const [byStatus, ca, paid, top] = await Promise.all([
        prisma.order.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { total: true } }),
        prisma.order.aggregate({ where: valid, _sum: { total: true }, _count: { _all: true } }),
        prisma.order.aggregate({ where: { AND: [valid, { paymentStatus: "PAYE" }] }, _sum: { total: true } }),
        prisma.orderItem.groupBy({
          by: ["productName"],
          where: { order: valid },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 10,
        }),
      ]);
      const n = ca._count._all;
      return {
        periodeJours: days,
        chiffreAffaires: ca._sum.total ?? 0,
        encaisse: paid._sum.total ?? 0,
        commandes: n,
        panierMoyen: n ? Math.round((ca._sum.total ?? 0) / n) : 0,
        parStatut: byStatus.map((s) => ({ statut: s.status, commandes: s._count._all, montant: s._sum.total ?? 0 })),
        meilleursProduits: top.map((t) => ({ produit: t.productName, quantite: t._sum.quantity ?? 0 })),
      };
    },
  },

  chercher_clients: {
    roles: ["ADMIN", "CONSULTANT"],
    declaration: {
      name: "chercher_clients",
      description: "Recherche des clients (nom, téléphone, e-mail) avec leurs achats. Le revendeur ne voit que ses clients.",
      parameters: {
        type: "object",
        properties: {
          requete: { type: "string", description: "Nom, téléphone ou e-mail (vide = meilleurs clients)" },
          limite: { type: "integer", description: "1 à 20, défaut 10" },
        },
      },
    },
    run: async (args, scope) => {
      const q = str(args.requete);
      const limit = int(args.limite, 10, 1, 20);
      const own = orderScope(scope);
      const customers = await prisma.customer.findMany({
        where: {
          AND: [
            scope.role === "ADMIN" ? {} : { orders: { some: own } },
            q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q.replace(/\s/g, "") } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        take: q ? limit : 200,
        select: {
          id: true, name: true, phone: true, email: true, loyaltyPoints: true, createdAt: true,
          orders: { where: { AND: [own, { status: { not: "ANNULEE" } }] }, select: { total: true, createdAt: true } },
        },
      });
      const rows = customers
        .map((c) => ({
          nom: c.name,
          telephone: c.phone,
          email: c.email,
          commandes: c.orders.length,
          totalAchats: c.orders.reduce((s, o) => s + o.total, 0),
          derniereCommande: c.orders.map((o) => o.createdAt).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString().slice(0, 10) ?? null,
          pointsFidelite: c.loyaltyPoints,
          lien: scope.role === "ADMIN" ? `/admin/clients/${c.id}` : "/admin/mes-clients",
        }))
        .sort((a, b) => b.totalAchats - a.totalAchats)
        .slice(0, limit);
      return { clients: rows };
    },
  },

  chercher_revendeurs: {
    roles: ["ADMIN"],
    declaration: {
      name: "chercher_revendeurs",
      description: "Recherche des revendeurs (consultants) par nom ou ville, avec leurs ventes sur 30 jours et leur parrain.",
      parameters: {
        type: "object",
        properties: {
          requete: { type: "string", description: "Nom ou ville (vide = meilleurs revendeurs du mois)" },
          limite: { type: "integer", description: "1 à 20, défaut 10" },
        },
      },
    },
    run: async (args) => {
      const q = str(args.requete);
      const limit = int(args.limite, 10, 1, 20);
      const consultants = await prisma.consultant.findMany({
        where: q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] }
          : {},
        take: q ? limit : 300,
        select: {
          id: true, name: true, city: true, whatsapp: true, active: true, slug: true, createdAt: true,
          sponsor: { select: { name: true } },
          _count: { select: { sponsored: true } },
          orders: { where: { status: { not: "ANNULEE" }, createdAt: { gte: since(30) } }, select: { total: true } },
        },
      });
      return {
        revendeurs: consultants
          .map((c) => ({
            nom: c.name,
            ville: c.city,
            whatsapp: c.whatsapp,
            actif: c.active,
            parrain: c.sponsor?.name ?? null,
            filleuls: c._count.sponsored,
            ventes30j: c.orders.reduce((s, o) => s + o.total, 0),
            commandes30j: c.orders.length,
            pagePerso: c.slug ? `/c/${c.slug}` : null,
            lien: `/admin/consultants/${c.id}`,
          }))
          .sort((a, b) => b.ventes30j - a.ventes30j)
          .slice(0, limit),
      };
    },
  },
};

/** Outils autorisés pour ce rôle. */
export function toolsFor(scope: AssistantScope): GeminiFunctionDeclaration[] {
  return Object.values(TOOLS)
    .filter((t) => t.roles.includes(scope.role))
    .map((t) => t.declaration);
}

/** Exécute un outil en revérifiant le rôle (le modèle ne peut pas appeler un outil non proposé). */
export async function runTool(name: string, args: Args, scope: AssistantScope): Promise<Record<string, unknown>> {
  const tool = TOOLS[name];
  if (!tool || !tool.roles.includes(scope.role)) return { erreur: `outil « ${name} » non disponible pour ce compte` };
  try {
    return { resultat: await tool.run(args ?? {}, scope) };
  } catch (e) {
    console.error("[assistant] outil", name, e);
    return { erreur: "lecture impossible pour le moment" };
  }
}
