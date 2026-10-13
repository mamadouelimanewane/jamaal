/**
 * Livreurs sur WhatsApp : commandes courtes, sans IA, pour faire avancer une livraison.
 *   « mes livraisons » · « récupéré 2RQ1YXQF » · « en route 2RQ1YXQF » · « livré 4821 »
 *   (code donné par le client) · « échec 2RQ1YXQF client absent »
 * La dernière position envoyée sur WhatsApp est jointe à l'étape.
 */
import { prisma } from "@/lib/prisma";
import { advanceDelivery, DeliveryError } from "@/lib/delivery-engine";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/delivery";

export type LivreurCommand =
  | { kind: "list" }
  | { kind: "step"; to: Exclude<DeliveryStatus, "ASSIGNEE" | "A_PREPARER">; ref?: string; code?: string; note?: string }
  | { kind: "help" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Analyse le message du livreur (pur, testé). */
export function parseLivreurCommand(raw: string): LivreurCommand {
  const t = norm(raw).replace(/\s+/g, " ");
  if (/^(mes )?(livraisons?|courses?|missions?)\b/.test(t) || t === "liste") return { kind: "list" };
  let m = t.match(/^(?:livre|livree|livrer|ok livre)\s+(\d{4})\b/);
  if (m) return { kind: "step", to: "LIVREE", code: m[1] };
  m = t.match(/^(recupere|recuperee|recup|pris|pickup)\s+([a-z0-9]{6,})/);
  if (m) return { kind: "step", to: "RECUPEREE", ref: m[2] };
  m = t.match(/^(en route|parti|depart|route)\s+([a-z0-9]{6,})/);
  if (m) return { kind: "step", to: "EN_ROUTE", ref: m[2] };
  m = t.match(/^(echec|impossible|probleme)\s+([a-z0-9]{6,})\s*(.*)$/);
  if (m) return { kind: "step", to: "ECHEC", ref: m[2], note: raw.trim().split(/\s+/).slice(2).join(" ") || m[3] };
  return { kind: "help" };
}

export const LIVREUR_HELP =
  "Commandes livreur :\n• *mes livraisons* : vos courses du jour\n• *récupéré 2RQ1YXQF* : colis pris au dépôt\n• *en route 2RQ1YXQF* : départ chez le client\n• *livré 4821* : code donné par le client\n• *échec 2RQ1YXQF raison* : livraison impossible\nEnvoyez votre position (📎 > Position) pour la joindre à l'étape.";

export async function runLivreurCommand(livreurId: string, text: string, location: { lat: number; lng: number } | null): Promise<string> {
  const cmd = parseLivreurCommand(text);
  const active = await prisma.order.findMany({
    where: { livreurId, deliveryMode: "LIVRAISON_JAMAAL", status: { not: "ANNULEE" }, deliveryStatus: { in: ["ASSIGNEE", "RECUPEREE", "EN_ROUTE"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, customerName: true, deliveryContactName: true, deliveryContactPhone: true, customerPhone: true, address: true, deliveryPlace: true, deliveryLat: true, deliveryLng: true, deliveryStatus: true, deliveryCode: true, total: true, paymentStatus: true },
  });
  if (cmd.kind === "help") return LIVREUR_HELP;
  if (cmd.kind === "list") {
    if (!active.length) return "Aucune livraison en cours. Bonne journée !";
    return [`${active.length} livraison(s) en cours :`, ...active.map((o) => `• *${o.id.slice(-8).toUpperCase()}* — ${o.deliveryContactName ?? o.customerName} (${o.deliveryContactPhone ?? o.customerPhone ?? "?"}) · ${DELIVERY_LABELS[o.deliveryStatus as DeliveryStatus]}${o.deliveryLat != null ? ` · https://maps.google.com/?q=${o.deliveryLat},${o.deliveryLng}` : ""}${o.paymentStatus === "PAYE" ? " · payé" : ` · à encaisser ${o.total.toLocaleString("fr-FR")} FCFA`}`)].join("\n");
  }
  let order = cmd.ref ? active.find((o) => o.id.toLowerCase().endsWith(cmd.ref!.toLowerCase())) : undefined;
  if (cmd.to === "LIVREE" && cmd.code) order = active.find((o) => o.deliveryCode === cmd.code);
  if (!order) return cmd.to === "LIVREE" ? "Aucune de vos livraisons en cours n'a ce code. Vérifiez le code avec le client." : "Commande introuvable parmi vos livraisons en cours. Envoyez *mes livraisons* pour la liste.";
  try {
    await advanceDelivery(order.id, cmd.to, { kind: "livreur", livreurId }, { code: cmd.code, note: cmd.note, lat: location?.lat, lng: location?.lng });
    const label = DELIVERY_LABELS[cmd.to];
    return `✅ ${order.id.slice(-8).toUpperCase()} : ${label}.${cmd.to === "LIVREE" ? " Merci !" : ""}`;
  } catch (e) {
    return e instanceof DeliveryError ? `⚠️ ${e.message}` : "⚠️ Étape impossible pour le moment, réessayez.";
  }
}
