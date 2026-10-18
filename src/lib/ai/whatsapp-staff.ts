/**
 * L'équipe sur WhatsApp : un revendeur, un admin ou un livreur qui écrit au numéro JAMAAL est
 * reconnu par son numéro (garanti par WhatsApp) et servi par son assistant :
 * - revendeur : son coach IA (ventes, gains, relances, textes marketing) + commande pour un client ;
 * - admin : l'assistant du back-office (toutes les données) + changement de statut confirmé ;
 * - livreur : commandes courtes (voir livreur-commands.ts), sans IA.
 */
import { prisma } from "@/lib/prisma";
import { phoneTail } from "@/lib/phone-match";
import { placeOrder, type CheckoutItem } from "@/lib/orders/place-order";
import { setOrderStatus } from "@/lib/orders/status";
import { runChat, systemPrompt, type ChatMessage } from "./assistant";
import { runTool, toolsFor, type AssistantScope } from "./assistant-tools";
import { pickFormat, resolveProduct } from "./whatsapp-sales";
import type { GeminiFunctionDeclaration } from "./gemini";

export type StaffIdentity =
  | { role: "LIVREUR"; livreurId: string; userId: string | null; name: string }
  | { role: "CONSULTANT"; consultantId: string; userId: string | null; name: string }
  | { role: "ADMIN"; userId: string | null; name: string };

type Args = Record<string, unknown>;
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Numéros admin déclarés (WHATSAPP_ADMIN_NUMBERS, séparés par des virgules). */
export function envAdminTails(raw = process.env.WHATSAPP_ADMIN_NUMBERS ?? ""): string[] {
  return raw.split(/[,;\n]+/).map(phoneTail).filter(Boolean);
}

/** Qui écrit ? Admin d'abord (compte ADMIN ou numéro déclaré), puis livreur, puis revendeur. */
export async function identifyStaff(phone: string): Promise<StaffIdentity | null> {
  const tail = phoneTail(phone);
  if (!tail) return null;
  const users = await prisma.$queryRaw<{ id: string; name: string; role: string; consultantId: string | null; livreurId: string | null; active: boolean; profileId: string | null }[]>`
    SELECT id, name, role::text AS role, "consultantId", "livreurId", active, "profileId" FROM "User" WHERE right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 3`;
  // Un compte suspendu n'est jamais reconnu ; un administrateur restreint (profil) n'a pas les pouvoirs complets par WhatsApp.
  if (users.some((u) => !u.active)) return null;
  const admin = users.find((u) => u.role === "ADMIN" && !u.profileId);
  if (admin) return { role: "ADMIN", userId: admin.id, name: admin.name };
  if (envAdminTails().includes(tail)) {
    const first = await prisma.user.findFirst({ where: { role: "ADMIN", active: true, profileId: null }, select: { id: true } });
    return { role: "ADMIN", userId: first?.id ?? null, name: "Équipe JAMAAL" };
  }
  const livreurs = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Livreur" WHERE active = true AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 1`;
  if (livreurs[0]) {
    const u = await prisma.user.findFirst({ where: { livreurId: livreurs[0].id }, select: { id: true, active: true } });
    if (u && !u.active) return null;
    return { role: "LIVREUR", livreurId: livreurs[0].id, userId: u?.id ?? null, name: livreurs[0].name };
  }
  const consultants = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Consultant" WHERE active = true AND right(regexp_replace(whatsapp, '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 1`;
  if (consultants[0]) {
    const u = await prisma.user.findFirst({ where: { consultantId: consultants[0].id }, select: { id: true, active: true } });
    if (u && !u.active) return null;
    return { role: "CONSULTANT", consultantId: consultants[0].id, userId: u?.id ?? null, name: consultants[0].name };
  }
  return null;
}

export function staffScope(s: StaffIdentity): AssistantScope {
  return {
    role: s.role,
    userId: s.userId ?? "whatsapp",
    consultantId: s.role === "CONSULTANT" ? s.consultantId : null,
    livreurId: s.role === "LIVREUR" ? s.livreurId : null,
  };
}

const CONSULTANT_EXTRA: GeminiFunctionDeclaration = {
  name: "commande_pour_client",
  description:
    "Crée une commande pour un client du revendeur (remise par le revendeur) et envoie au client, sur WhatsApp, le récapitulatif avec le bouton « Payer ». À n'appeler qu'après avoir récapitulé au revendeur (client, articles, formats, quantités, prix) et obtenu son « oui ».",
  parameters: {
    type: "object",
    properties: {
      client_nom: { type: "string", description: "Prénom et nom du client" },
      client_telephone: { type: "string", description: "Numéro WhatsApp du client (ex. 77 123 45 67)" },
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: { produit: { type: "string" }, format: { type: "string" }, quantite: { type: "integer" } },
          required: ["produit", "quantite"],
        },
      },
      confirme: { type: "boolean", description: "true seulement après le « oui » du revendeur" },
    },
    required: ["client_nom", "client_telephone", "articles", "confirme"],
  },
};

const ADMIN_EXTRA: GeminiFunctionDeclaration = {
  name: "changer_statut_commande",
  description:
    "Change le statut d'une commande (CONFIRMEE, EXPEDIEE, LIVREE, ANNULEE). Le client est prévenu sur WhatsApp. À n'appeler qu'après avoir rappelé la commande (client, total, statut actuel) et obtenu un « oui » explicite.",
  parameters: {
    type: "object",
    properties: {
      numero: { type: "string", description: "Numéro de commande (8 derniers caractères, ex. 2RQ1YXQF)" },
      statut: { type: "string", enum: ["CONFIRMEE", "EXPEDIEE", "LIVREE", "ANNULEE"] },
      confirme: { type: "boolean" },
    },
    required: ["numero", "statut", "confirme"],
  },
};

async function orderForClient(args: Args, s: Extract<StaffIdentity, { role: "CONSULTANT" }>, staffPhone: string) {
  if (args.confirme !== true) return { erreur: "Récapitule d'abord la commande au revendeur et demande sa confirmation." };
  const name = str(args.client_nom);
  const phone = str(args.client_telephone, 30);
  if (name.length < 2) return { erreur: "Nom du client manquant." };
  if (phone.replace(/\D/g, "").length < 9) return { erreur: "Numéro du client manquant ou incomplet." };
  const lines = Array.isArray(args.articles) ? (args.articles as Args[]).slice(0, 15) : [];
  if (!lines.length) return { erreur: "Aucun article." };
  const items: CheckoutItem[] = [];
  for (const l of lines) {
    const product = await resolveProduct(str(l.produit, 100));
    if (!product) return { erreur: `Produit introuvable : « ${str(l.produit)} ».` };
    const fmt = pickFormat(product, str(l.format, 40));
    if ("error" in fmt) return { erreur: fmt.error };
    items.push({ productId: product.id, productName: product.name, volumeLabel: fmt.label, price: fmt.price, quantity: Math.min(20, Math.max(1, Math.round(Number(l.quantite) || 1))) });
  }
  try {
    const id = await placeOrder({ name, phone }, items, s.consultantId, true, false, "", { mode: "RETRAIT" }, false, {
      rateKey: `order-wa-staff:${staffPhone}`,
      channel: "WhatsApp (revendeur)",
      source: "REVENDEUR",
    });
    const order = await prisma.order.findUnique({ where: { id }, select: { total: true } });
    return { commandeCreee: true, numero: id.slice(-8).toUpperCase(), total: order?.total, clientPrevenu: "Le client reçoit le récapitulatif et le bouton « Payer » sur WhatsApp.", lienPaiement: `/commande/${id}`, suivi: `/admin/mes-commandes/${id}` };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Commande impossible pour le moment." };
  }
}

async function changeStatus(args: Args) {
  const ref = str(args.numero, 30).replace(/[^a-z0-9]/gi, "").toLowerCase();
  const status = str(args.statut, 20) as "CONFIRMEE" | "EXPEDIEE" | "LIVREE" | "ANNULEE";
  if (!["CONFIRMEE", "EXPEDIEE", "LIVREE", "ANNULEE"].includes(status)) return { erreur: "Statut inconnu." };
  if (ref.length < 6) return { erreur: "Numéro de commande à préciser (8 caractères)." };
  const found = await prisma.order.findMany({ where: { id: { endsWith: ref } }, select: { id: true, status: true, customerName: true, total: true }, take: 2 });
  if (found.length !== 1) return { erreur: found.length ? "Plusieurs commandes correspondent : donne le numéro complet." : "Commande introuvable." };
  const o = found[0];
  if (args.confirme !== true) return { aConfirmer: { numero: ref.toUpperCase(), client: o.customerName, total: o.total, statutActuel: o.status, nouveauStatut: status } };
  if (o.status === status) return { info: "La commande a déjà ce statut." };
  await setOrderStatus(o.id, status);
  return { fait: true, numero: o.id.slice(-8).toUpperCase(), ancienStatut: o.status, nouveauStatut: status, clientPrevenu: true };
}

const WA_RULES = `

Tu réponds sur WhatsApp : messages courts, pas de tableau, *gras* avec une étoile. Les liens du back-office s'écrivent [texte](/admin/...).
Tu peux ajouter, à la toute fin, un seul marqueur de boutons : [[boutons: Choix 1 | Choix 2]] (3 au plus, 20 caractères chacun).`;

export function staffSystemPrompt(s: StaffIdentity): string {
  const base = systemPrompt(staffScope(s));
  if (s.role === "CONSULTANT") {
    return `${base}${WA_RULES}
Tu parles à ${s.name}, revendeur JAMAAL, sur son WhatsApp.
Exception à la règle « tu ne peux rien modifier » : avec commande_pour_client, tu peux créer une commande pour un de ses clients (remise par le revendeur), après récapitulatif et « oui ». Le client reçoit alors automatiquement le bouton « Payer ».
Les textes prêts à envoyer restent dans un bloc entre deux lignes \`\`\` pour qu'il puisse les copier.`;
  }
  return `${base}${WA_RULES}
Tu parles à ${s.name}, de l'équipe JAMAAL (admin), sur WhatsApp.
Exception à la règle « tu ne peux rien modifier » : avec changer_statut_commande, tu peux changer le statut d'une commande. Appelle-le d'abord avec confirme=false pour vérifier, rappelle la commande, attends un « oui », puis appelle-le avec confirme=true.`;
}

export async function runStaffWhatsApp(s: Exclude<StaffIdentity, { role: "LIVREUR" }>, staffPhone: string, history: ChatMessage[]): Promise<string> {
  const scope = staffScope(s);
  const extra = s.role === "CONSULTANT" ? CONSULTANT_EXTRA : ADMIN_EXTRA;
  const answer = await runChat({
    system: staffSystemPrompt(s),
    tools: [...toolsFor(scope), extra],
    exec: async (name, args) => {
      try {
        if (name === "commande_pour_client" && s.role === "CONSULTANT") return { resultat: await orderForClient(args ?? {}, s, staffPhone) };
        if (name === "changer_statut_commande" && s.role === "ADMIN") return { resultat: await changeStatus(args ?? {}) };
      } catch (e) {
        console.error("[whatsapp] outil équipe", name, e);
        return { erreur: "action impossible pour le moment" };
      }
      return runTool(name, args, scope);
    },
    history,
    thinking: "low",
  });
  return answer.text;
}
