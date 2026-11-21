/**
 * Pixel Meta côté serveur (API Conversions) : un « Purchase » est envoyé à Meta quand une commande est
 * réellement payée (paiement en ligne confirmé, « Paiement reçu », espèces encaissées par le livreur),
 * même si le client ne revoit jamais la page de confirmation. Même identifiant d'événement que le pixel
 * du navigateur (l'id de la commande) : Meta ne le compte qu'une fois.
 * Actif seulement si META_CAPI_ACCESS_TOKEN est renseigné dans Vercel (jeton généré dans le Gestionnaire
 * d'événements › Paramètres › API Conversions). META_CAPI_TEST_CODE : code d'événements de test (facultatif).
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import { getSiteUrl } from "@/lib/site-url";

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v25.0"}`;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/** Téléphone au format attendu par Meta : chiffres avec l'indicatif (221 pour le Sénégal). */
export function metaPhone(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && /^[37]/.test(d)) d = `221${d}`;
  return d.length >= 9 ? d : null;
}

export function purchasePayload(o: {
  id: string;
  total: number;
  deliveryFee: number;
  customerEmail: string | null;
  customerPhone: string | null;
  customerId: string | null;
  paidAt: Date | null;
  items: { productId: string | null; quantity: number; price: number }[];
}, origin: string) {
  const email = o.customerEmail?.trim().toLowerCase();
  const phone = metaPhone(o.customerPhone);
  return {
    event_name: "Purchase",
    event_time: Math.floor((o.paidAt ?? new Date()).getTime() / 1000),
    event_id: o.id,
    action_source: "website",
    event_source_url: `${origin}/commande/${o.id}`,
    user_data: {
      ...(email ? { em: [sha(email)] } : {}),
      ...(phone ? { ph: [sha(phone)] } : {}),
      ...(o.customerId ? { external_id: [sha(o.customerId)] } : {}),
      country: [sha("sn")],
    },
    custom_data: {
      currency: "XOF",
      value: o.total,
      order_id: o.id,
      content_type: "product",
      content_ids: o.items.flatMap((i) => (i.productId ? [i.productId] : [])),
      contents: o.items.flatMap((i) => (i.productId ? [{ id: i.productId, quantity: i.quantity, item_price: i.price }] : [])),
      num_items: o.items.reduce((s, i) => s + i.quantity, 0),
    },
  };
}

/** Envoie l'achat d'une commande payée à Meta. Sans jeton, ou commande non payée / annulée : rien. */
export async function sendMetaPurchase(orderId: string) {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!token || !/^\d{5,30}$/.test(META_PIXEL_ID)) return false;
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, total: true, deliveryFee: true, customerEmail: true, customerPhone: true, customerId: true, paidAt: true, paymentStatus: true, status: true, items: { select: { productId: true, quantity: true, price: true } } },
  });
  if (!o || o.paymentStatus !== "PAYE" || o.status === "ANNULEE") return false;
  const body = { data: [purchasePayload(o, await getSiteUrl())], ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}) };
  const res = await fetch(`${GRAPH}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) console.error("[meta-capi]", orderId, res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

/** Ne bloque jamais un paiement. */
export async function safeMetaPurchase(orderId: string) {
  await sendMetaPurchase(orderId).catch((e) => console.error("[meta-capi]", orderId, e));
}
