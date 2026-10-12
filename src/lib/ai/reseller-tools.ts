/**
 * Outils de l'assistant IA réservés au revendeur (rôle CONSULTANT) : son tableau de bord
 * (gains, wallet, primes, objectif, classement), ses liens et codes promo, les clients à relancer,
 * son équipe, les tendances de la boutique, le kit marketing et les règles du programme.
 * Tout est filtré sur la fiche du revendeur connecté ; rien n'est écrit en base.
 * Les modules qui dépendent de la requête (URL du site) sont chargés à la demande.
 */
import { prisma } from "@/lib/prisma";
import { canonicalizePhone } from "@/lib/phone";
import type { GeminiFunctionDeclaration } from "./gemini";
import type { AssistantScope } from "./assistant-tools";

type Args = Record<string, unknown>;
export interface ResellerToolDef {
  declaration: GeminiFunctionDeclaration;
  roles: AssistantScope["role"][];
  run: (args: Args, scope: AssistantScope) => Promise<unknown>;
}

const DAY_MS = 86_400_000;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const str = (v: unknown, max = 100) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function int(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
}
const monthStart = (offset = 0, d = new Date()) => new Date(d.getFullYear(), d.getMonth() + offset, 1);

/** Lien WhatsApp « cliquer pour écrire », avec un message pré-rempli facultatif. */
export function waLink(phone: string | null | undefined, text?: string): string | null {
  const digits = phone ? canonicalizePhone(phone) : "";
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function needConsultant(scope: AssistantScope): string {
  if (!scope.consultantId) throw new NoProfile();
  return scope.consultantId;
}
class NoProfile extends Error {}

async function siteOrigin(): Promise<string> {
  try {
    const { getSiteUrl } = await import("@/lib/site-url");
    return await getSiteUrl();
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  }
}

/** Commandes qui comptent dans les ventes (non annulées). */
const VALID = { status: { not: "ANNULEE" as const } };

export const RESELLER_TOOLS: Record<string, ResellerToolDef> = {
  mon_tableau_de_bord: {
    roles: ["CONSULTANT"],
    declaration: {
      name: "mon_tableau_de_bord",
      description:
        "Situation du revendeur ce mois-ci : ventes encaissées, commissions (personnelles et d'équipe), solde du wallet, prime mensuelle (palier atteint, palier suivant et montant restant), objectif du mois, rang (Gold/Silver/Bronze) et place au classement, jours restants. À utiliser pour « combien j'ai gagné ? », « où j'en suis ? », « combien me manque-t-il pour la prime ? », ou avant de proposer un plan d'action.",
      parameters: { type: "object", properties: {} },
    },
    run: async (_args, scope) => {
      const id = needConsultant(scope);
      const [{ getConsultantCommission }, { walletBalance }, { getBusinessModel }, { primeStatus }, ranking] = await Promise.all([
        import("@/lib/commission"),
        import("@/lib/wallet"),
        import("@/lib/business-model-store"),
        import("@/lib/business-model"),
        import("@/lib/ranking"),
      ]);
      const now = new Date();
      const [commission, wallet, model, rankings, target, ordersThisMonth, ordersLastMonth] = await Promise.all([
        getConsultantCommission(id),
        walletBalance({ type: "CONSULTANT", id }),
        getBusinessModel(),
        ranking.getConsultantRankings(0),
        prisma.monthlyTarget
          .findFirst({ where: { consultantId: id, year: now.getFullYear(), month: now.getMonth() + 1 } })
          .then((t) => t ?? prisma.monthlyTarget.findFirst({ where: { consultantId: null, year: now.getFullYear(), month: now.getMonth() + 1 } })),
        prisma.order.aggregate({ where: { consultantId: id, ...VALID, createdAt: { gte: monthStart() } }, _sum: { total: true }, _count: { _all: true } }),
        prisma.order.aggregate({ where: { consultantId: id, ...VALID, createdAt: { gte: monthStart(-1), lt: monthStart() } }, _sum: { total: true }, _count: { _all: true } }),
      ]);
      const sorted = [...rankings].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
      const mine = sorted.find((r) => r.consultantId === id) ?? { consultantId: id, monthlyRevenue: 0, activeSponsoredCount: 0, rank: null };
      const place = sorted.findIndex((r) => r.consultantId === id);
      const next = ranking.getProgressToNextRank(mine);
      const prime = primeStatus(commission.monthlyRevenue, model);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysLeft = daysInMonth - now.getDate();
      return {
        mois: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
        joursRestants: daysLeft,
        ventesEncaisseesDuMois: commission.monthlyRevenue,
        commandesDuMois: { nombre: ordersThisMonth._count._all, montant: ordersThisMonth._sum.total ?? 0 },
        moisPrecedent: { nombre: ordersLastMonth._count._all, montant: ordersLastMonth._sum.total ?? 0 },
        commissions: {
          tauxVente: `${commission.rate} %`,
          duMois: commission.monthlyCommission,
          equipeDuMois: commission.monthlySponsorCommission + commission.monthlyL2Commission,
          depuisLeDebut: commission.lifetimeCommission + commission.lifetimeSponsorCommission + commission.lifetimeL2Commission,
        },
        wallet: { soldeDisponible: wallet.balance, retraitsEnCours: wallet.pendingOut, totalGagne: wallet.earned, lien: "/admin/mon-wallet" },
        primeMensuelle: model.primesEnabled
          ? {
              palierAtteint: prime.reached ? { seuil: prime.reached.threshold, prime: prime.reached.amount, bonus: prime.reached.extra ?? null } : null,
              palierSuivant: prime.next ? { seuil: prime.next.threshold, prime: prime.next.amount, bonus: prime.next.extra ?? null } : null,
              resteAVendre: prime.remaining,
              progression: `${prime.progress} %`,
            }
          : "primes désactivées",
        objectifDuMois: target ? { montant: target.targetRevenue, atteint: `${Math.round((commission.monthlyRevenue / Math.max(1, target.targetRevenue)) * 100)} %` } : null,
        rang: mine.rank ?? "aucun (pas encore de vente ce mois)",
        prochainRang: next.nextRank ? { rang: next.nextRank, ventesManquantes: next.revenueNeeded, filleulsActifsManquants: next.sponsoredNeeded } : null,
        classement: place >= 0 && mine.monthlyRevenue > 0 ? { place: place + 1, sur: sorted.filter((r) => r.monthlyRevenue > 0).length } : null,
        bonusPremierDuClassement: model.topSellerBonus || null,
        liens: { gains: "/admin/mes-gains", ventes: "/admin/mes-ventes" },
      };
    },
  },

  mes_liens_et_codes: {
    roles: ["CONSULTANT"],
    declaration: {
      name: "mes_liens_et_codes",
      description:
        "Liens personnels du revendeur (sa boutique, son lien de recrutement, lien d'un produit avec son code pour que la vente lui soit attribuée) et ses codes promo actifs. À utiliser dès qu'un message marketing, un statut ou un post doit contenir un lien, ou pour « quel est mon lien ? ».",
      parameters: {
        type: "object",
        properties: { produits: { type: "string", description: "Noms ou codes de produits dont il faut le lien, séparés par des virgules (facultatif)" } },
      },
    },
    run: async (args, scope) => {
      const id = needConsultant(scope);
      const [me, origin, codes] = await Promise.all([
        prisma.consultant.findUnique({ where: { id }, select: { slug: true, name: true, whatsapp: true, city: true } }),
        siteOrigin(),
        prisma.promoCode.findMany({ where: { consultantId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
      ]);
      const ref = me?.slug ? `?ref=${me.slug}` : "";
      const wanted = str(args.produits, 300).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
      const products = wanted.length
        ? await Promise.all(
            wanted.map((q) =>
              prisma.product.findFirst({
                where: { OR: [{ choganCode: { equals: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { inspiredBy: { contains: q, mode: "insensitive" } }] },
                select: { name: true, slug: true, regularPrice: true, choganCode: true },
              })
            )
          )
        : [];
      const now = Date.now();
      return {
        nom: me?.name,
        ville: me?.city,
        maBoutique: me?.slug ? `${origin}/c/${me.slug}` : "pas encore de lien personnel : à créer dans Mon marketing (/admin/mon-marketing)",
        lienRecrutement: me?.slug ? `${origin}/devenir-consultant${ref}` : null,
        catalogue: `${origin}/collections${ref}`,
        produits: products.map((p, i) => (p ? { recherche: wanted[i], nom: p.name, code: p.choganCode, prix: p.regularPrice, lien: `${origin}/produits/${p.slug}${ref}` } : { recherche: wanted[i], introuvable: true })),
        codesPromo: codes
          .filter((c) => (!c.expiresAt || c.expiresAt.getTime() > now) && (!c.usageLimit || c.usedCount < c.usageLimit))
          .map((c) => ({ code: c.code, remise: `${c.discountPct} %`, utilisations: c.usedCount, limite: c.usageLimit || null, expire: c.expiresAt?.toISOString().slice(0, 10) ?? null })),
        pageMarketing: "/admin/mon-marketing",
      };
    },
  },

  clients_a_relancer: {
    roles: ["CONSULTANT"],
    declaration: {
      name: "clients_a_relancer",
      description:
        "Clients du revendeur à relancer : sans achat depuis N jours, avec ce qu'ils ont acheté (pour proposer une recharge ou un parfum proche), leur total et un lien WhatsApp direct. Aussi : clients à un seul achat, et commandes en attente de paiement. À utiliser pour « qui relancer ? », « prépare mes relances », « clients inactifs ».",
      parameters: {
        type: "object",
        properties: {
          jours: { type: "integer", description: "Sans achat depuis au moins N jours (défaut 30, 7 à 365)" },
          limite: { type: "integer", description: "1 à 25, défaut 12" },
        },
      },
    },
    run: async (args, scope) => {
      const id = needConsultant(scope);
      const days = int(args.jours, 30, 7, 365);
      const limit = int(args.limite, 12, 1, 25);
      const [orders, unpaid] = await Promise.all([
        prisma.order.findMany({
          where: { consultantId: id, ...VALID },
          orderBy: { createdAt: "desc" },
          take: 1500,
          select: { customerName: true, customerPhone: true, customerId: true, createdAt: true, total: true, items: { select: { productName: true, volumeLabel: true } } },
        }),
        prisma.order.findMany({
          where: { consultantId: id, ...VALID, paymentStatus: "EN_ATTENTE", createdAt: { gte: new Date(Date.now() - 60 * DAY_MS) } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, customerName: true, customerPhone: true, total: true, createdAt: true },
        }),
      ]);
      type Row = { nom: string; tel: string | null; derniere: Date; commandes: number; total: number; produits: Set<string> };
      const byClient = new Map<string, Row>();
      for (const o of orders) {
        const key = o.customerId ?? (o.customerPhone ? canonicalizePhone(o.customerPhone) : o.customerName.toLowerCase());
        const r = byClient.get(key) ?? { nom: o.customerName, tel: o.customerPhone, derniere: o.createdAt, commandes: 0, total: 0, produits: new Set<string>() };
        r.commandes++;
        r.total += o.total;
        if (o.createdAt > r.derniere) r.derniere = o.createdAt;
        for (const it of o.items) if (r.produits.size < 5) r.produits.add(`${it.productName} (${it.volumeLabel})`);
        byClient.set(key, r);
      }
      const cutoff = Date.now() - days * DAY_MS;
      const all = [...byClient.values()];
      const toRelaunch = all.filter((r) => r.derniere.getTime() < cutoff).sort((a, b) => b.total - a.total);
      const fmt = (r: Row) => ({
        client: r.nom,
        telephone: r.tel,
        dernierAchat: r.derniere.toISOString().slice(0, 10),
        joursSansAchat: Math.floor((Date.now() - r.derniere.getTime()) / DAY_MS),
        commandes: r.commandes,
        totalAchats: r.total,
        produitsAchetes: [...r.produits],
        whatsapp: waLink(r.tel),
      });
      return {
        clientsEnTout: all.length,
        aRelancer: toRelaunch.length,
        clients: toRelaunch.slice(0, limit).map(fmt),
        unSeulAchat: all.filter((r) => r.commandes === 1 && r.derniere.getTime() >= cutoff).slice(0, 8).map(fmt),
        paiementsEnAttente: unpaid.map((o) => ({ client: o.customerName, montant: o.total, date: o.createdAt.toISOString().slice(0, 10), whatsapp: waLink(o.customerPhone), lien: `/admin/mes-commandes/${o.id}` })),
        conseil: "Pour un lien WhatsApp avec message pré-rempli : https://wa.me/<numéro>?text=<message encodé>.",
      };
    },
  },

  mon_equipe: {
    roles: ["CONSULTANT"],
    declaration: {
      name: "mon_equipe",
      description:
        "Équipe du revendeur (filleuls directs et leurs propres filleuls) : ventes du mois de chacun, membres inactifs à motiver, prime d'équipe (palier atteint et suivant), bonus démarrage rapide, places restantes. À utiliser pour « comment va mon équipe ? », « qui motiver ? », « comment recruter ? ».",
      parameters: { type: "object", properties: {} },
    },
    run: async (_args, scope) => {
      const id = needConsultant(scope);
      const [{ getBusinessModel }, { primeStatus }, { teamSummary }] = await Promise.all([
        import("@/lib/business-model-store"),
        import("@/lib/business-model"),
        import("@/lib/team"),
      ]);
      const since = monthStart();
      const [model, direct, fastStart] = await Promise.all([
        getBusinessModel(),
        prisma.consultant.findMany({
          where: { sponsorId: id },
          select: {
            id: true, name: true, city: true, whatsapp: true, active: true, createdAt: true,
            orders: { where: { ...VALID, createdAt: { gte: since } }, select: { total: true } },
            sponsored: { select: { id: true, name: true, orders: { where: { ...VALID, createdAt: { gte: since } }, select: { total: true } } } },
          },
        }),
        prisma.fastStartBonus.findMany({ where: { sponsorId: id }, select: { amount: true, status: true, sponsoree: { select: { name: true } } } }),
      ]);
      const summary = await teamSummary(id, model);
      const sum = (os: { total: number }[]) => os.reduce((s, o) => s + o.total, 0);
      const members = direct.map((m) => ({
        nom: m.name,
        ville: m.city,
        actif: m.active,
        ventesDuMois: sum(m.orders),
        depuis: m.createdAt.toISOString().slice(0, 10),
        whatsapp: waLink(m.whatsapp),
        sesFilleuls: m.sponsored.map((s) => ({ nom: s.name, ventesDuMois: sum(s.orders) })),
      }));
      const teamSales = members.reduce((s, m) => s + m.ventesDuMois + m.sesFilleuls.reduce((t, f) => t + f.ventesDuMois, 0), 0);
      const tiers = summary.title === "Leader" ? model.leaderTeamTiers : summary.title === "Parrain" ? model.parrainTeamTiers : [];
      const prime = tiers.length ? primeStatus(teamSales, model, tiers) : null;
      return {
        monTitre: summary.title,
        peutRecruter: summary.recruitTitle !== null,
        titreDeMesRecrues: summary.recruitTitle,
        placesMax: summary.limit || "illimité",
        membresDirects: members.length,
        ventesEquipeDuMois: teamSales,
        membres: members.sort((a, b) => b.ventesDuMois - a.ventesDuMois),
        sansVenteCeMois: members.filter((m) => m.ventesDuMois === 0).map((m) => m.nom),
        primeEquipe:
          model.teamPrimesEnabled && prime
            ? { palierAtteint: prime.reached?.amount ?? 0, palierSuivant: prime.next ? { seuil: prime.next.threshold, prime: prime.next.amount } : null, resteAVendre: prime.remaining }
            : null,
        bonusDemarrageRapide: fastStart.map((f) => ({ filleul: f.sponsoree.name, montant: f.amount, statut: f.status })),
        lien: "/admin/mes-filleuls",
      };
    },
  },

  tendances_boutique: {
    roles: ["CONSULTANT"],
    declaration: {
      name: "tendances_boutique",
      description:
        "Ce qui se vend le mieux dans toute la boutique JAMAAL sur la période (tous revendeurs confondus, sans donnée personnelle), les nouveautés et les produits en stock à mettre en avant. À utiliser pour choisir les produits d'une campagne, d'un statut WhatsApp ou d'une offre.",
      parameters: {
        type: "object",
        properties: {
          jours: { type: "integer", description: "Période (défaut 30, 7 à 180)" },
          categorie: { type: "string", description: "Catégorie (ex. parfum-femme, maquillage), facultatif" },
        },
      },
    },
    run: async (args) => {
      const days = int(args.jours, 30, 7, 180);
      const cat = str(args.categorie, 40).toLowerCase();
      const catFilter = cat ? { product: { category: { contains: cat, mode: "insensitive" as const } } } : {};
      const [top, fresh] = await Promise.all([
        prisma.orderItem.groupBy({
          by: ["productId"],
          where: { order: { ...VALID, createdAt: { gte: new Date(Date.now() - days * DAY_MS) } }, ...catFilter },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 12,
        }),
        prisma.product.findMany({
          where: { createdAt: { gte: new Date(Date.now() - 60 * DAY_MS) }, ...(cat ? { category: { contains: cat, mode: "insensitive" } } : {}) },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { name: true, slug: true, regularPrice: true, inspiredBy: true, inspiredBrand: true, stock: true, variants: { select: { stock: true } } },
        }),
      ]);
      const ids = top.map((t) => t.productId).filter((x): x is string => !!x);
      const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, slug: true, regularPrice: true, inspiredBy: true, inspiredBrand: true, family: true, stock: true, variants: { select: { stock: true } } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const stockOf = (p: { stock: number; variants: { stock: number }[] }) => (p.variants.length ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock);
      const inspired = (p: { inspiredBy: string | null; inspiredBrand: string | null }) => (p.inspiredBy ? `${p.inspiredBy}${p.inspiredBrand ? ` (${p.inspiredBrand})` : ""}` : null);
      return {
        periodeJours: days,
        meilleuresVentes: top.flatMap((t) => {
          const p = t.productId ? byId.get(t.productId) : null;
          return p ? [{ produit: p.name, inspireDe: inspired(p), famille: p.family, prix: p.regularPrice, vendus: t._sum.quantity ?? 0, enStock: stockOf(p), lien: `/produits/${p.slug}` }] : [];
        }),
        nouveautes: fresh.map((p) => ({ produit: p.name, inspireDe: inspired(p), prix: p.regularPrice, enStock: stockOf(p), lien: `/produits/${p.slug}` })),
      };
    },
  },

  kit_marketing: {
    roles: ["CONSULTANT"],
    declaration: {
      name: "kit_marketing",
      description: "Annonces de JAMAAL aux revendeurs (offres, nouveautés, consignes) et visuels du kit marketing à télécharger. À consulter avant de préparer une campagne.",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const [news, assets] = await Promise.all([
        prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 6, select: { title: true, body: true, pinned: true, createdAt: true } }),
        prisma.marketingAsset.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { title: true, category: true, fileUrl: true } }),
      ]);
      return {
        annonces: news.map((a) => ({ titre: a.title, texte: a.body.slice(0, 600), epinglee: a.pinned, date: a.createdAt.toISOString().slice(0, 10) })),
        visuels: assets.map((a) => ({ titre: a.title, categorie: a.category, fichier: a.fileUrl })),
        pages: { kit: "/admin/mon-kit-marketing", communication: "/admin/ma-communication", marketing: "/admin/mon-marketing" },
      };
    },
  },

  regles_programme: {
    roles: ["CONSULTANT", "ADMIN"],
    declaration: {
      name: "regles_programme",
      description:
        "Règles du programme revendeur JAMAAL : taux de commission (vente, parrain, grand-parrain), primes mensuelles et d'équipe par palier, bonus du 1er, retrait minimal du wallet, moment du versement, livraison offerte. À utiliser pour « comment je gagne de l'argent ? », « combien je touche sur une vente ? », « comment marche la prime ? ».",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const [{ getBusinessModel }, { minWithdrawal }] = await Promise.all([import("@/lib/business-model-store"), import("@/lib/wallet")]);
      const [m, minW] = await Promise.all([getBusinessModel(), minWithdrawal()]);
      const tiers = (ts: { threshold: number; amount: number; extra?: string }[]) => ts.map((t) => ({ seuil: t.threshold, prime: t.amount, bonus: t.extra ?? null }));
      return {
        commissionVente: `${m.sellerPct} % du prix de vente (hors livraison), sur les commandes encaissées`,
        parrainDirect: `${m.sponsorSharedPct} % des ventes de ses filleuls (${m.sponsorAlonePct} % s'il n'a pas lui-même de parrain)`,
        grandParrain: `${m.grandSponsorPct} % des ventes des filleuls de ses filleuls`,
        primesMensuelles: m.primesEnabled ? tiers(m.primeTiers) : "désactivées",
        primesEquipe: m.teamPrimesEnabled ? { leader: tiers(m.leaderTeamTiers), parrain: tiers(m.parrainTeamTiers) } : "désactivées",
        bonusPremierDuMois: m.topSellerBonus || null,
        versement: m.payoutTrigger === "DELIVERED" ? "commission créditée au wallet à la livraison" : "commission créditée au wallet dès le paiement confirmé",
        retraitMinimal: minW,
        livraisonOfferteDes: m.deliveryFreeAbove || null,
        protocole: "/admin/mon-protocole",
      };
    },
  },
};

/** Message clair quand le compte revendeur n'a pas de fiche liée. */
export function isNoProfile(e: unknown): boolean {
  return e instanceof NoProfile;
}
