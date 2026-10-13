/**
 * Traitement d'un message WhatsApp reçu, dans l'ordre :
 * 1. vocal ou photo : transcrits / décrits par l'IA (le texte remplace « [audio] » dans le journal) ;
 * 2. STOP / START (messages automatiques) ;
 * 3. équipe reconnue par son numéro : livreur (commandes courtes), revendeur ou admin (assistant) ;
 * 4. client : assistant de commande, sauf si un conseiller a repris la conversation
 *    (boîte de réception : l'assistant est en pause jusqu'à botPausedUntil).
 * Le site reste le parcours classique : WhatsApp le complète, chaque réponse peut renvoyer au site.
 */
import { prisma } from "@/lib/prisma";
import { setPhoneOptOut } from "@/lib/phone-match";
import { rateLimit } from "@/lib/rate-limit";
import { geminiConfigured, readMedia } from "@/lib/ai/gemini";
import { automationEnabled } from "@/lib/automation-settings";
import { runWhatsAppSales, whatsappHistory } from "@/lib/ai/whatsapp-sales";
import { identifyStaff, runStaffWhatsApp } from "@/lib/ai/whatsapp-staff";
import { runLivreurCommand } from "./livreur-commands";
import { describeCatalogOrder } from "./catalog";
import { downloadMetaMedia } from "./meta";
import { sendWhatsApp, touchThread } from "./index";
import { optCommand, parseReplyMarkers, toWhatsAppText } from "./format";

export interface InboundMessage {
  phone: string;
  text: string | null;
  location: { lat: number; lng: number } | null;
  profileName: string | null;
  origin: string;
  /** Identifiant Meta du message (pour compléter le journal). */
  providerId?: string;
  /** Vocal ou photo à lire. */
  media?: { id: string; kind: "audio" | "image"; caption?: string | null } | null;
  /** Panier envoyé depuis le catalogue WhatsApp. */
  catalogOrder?: { retailerId: string; quantity: number }[] | null;
}

/** Dernière position envoyée par ce numéro dans les 24 h. */
export async function lastLocation(phone: string): Promise<{ lat: number; lng: number } | null> {
  const row = await prisma.whatsAppMessage.findFirst({
    where: { toNumber: phone, direction: "IN", body: { startsWith: "[position]" }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  const m = row?.body.match(/^\[position\] (-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

/** Remplace le corps du message reçu dans le journal (transcription, panier…). */
async function rewriteInbound(providerId: string | undefined, body: string) {
  if (!providerId) return;
  await prisma.whatsAppMessage.updateMany({ where: { providerId, direction: "IN" }, data: { body: body.slice(0, 1500) } }).catch(() => {});
}

/** Texte d'un vocal ou d'une photo, ou null si illisible. */
async function mediaText(media: NonNullable<InboundMessage["media"]>): Promise<string | null> {
  if (!geminiConfigured()) return null;
  const file = await downloadMetaMedia(media.id);
  if (!file) return null;
  try {
    const read = (await readMedia(file, media.kind)).trim();
    if (!read) return null;
    return media.kind === "audio" ? `[vocal] ${read}` : `[photo] ${read}${media.caption ? ` — ${media.caption}` : ""}`;
  } catch (e) {
    console.error("[whatsapp] lecture média", e);
    return null;
  }
}

async function reply(to: string, raw: string, origin: string, extra: { cta?: { label: string; url: string } } = {}) {
  const parsed = parseReplyMarkers(raw, origin);
  const text = toWhatsAppText(parsed.text, origin);
  const cta = parsed.cta ?? extra.cta;
  await sendWhatsApp({ to, text, kind: "bot", free: true, ...(cta ? { cta } : parsed.buttons ? { buttons: parsed.buttons } : {}) });
}

export async function handleInboundWhatsApp(msg: InboundMessage): Promise<void> {
  await touchThread(msg.phone, { name: msg.profileName, inbound: true });

  // 1. Vocal / photo / panier du catalogue → texte.
  let text = msg.text;
  if (msg.media) {
    const read = await mediaText(msg.media);
    if (read) {
      text = read;
      await rewriteInbound(msg.providerId, read);
    } else if (msg.media.caption) text = msg.media.caption;
  }
  if (msg.catalogOrder?.length) {
    text = await describeCatalogOrder(msg.catalogOrder);
    await rewriteInbound(msg.providerId, text);
  }

  // 2. STOP / START.
  const command = text ? optCommand(text) : null;
  if (command) {
    const updated = await setPhoneOptOut(msg.phone, command === "STOP");
    // Numéro inconnu : on crée la fiche pour mémoriser le STOP.
    if (!updated && command === "STOP") await prisma.customer.create({ data: { name: "Client WhatsApp", phone: msg.phone, whatsappOptOut: true } }).catch(() => {});
    await sendWhatsApp({
      to: msg.phone,
      kind: "bot",
      free: true,
      text:
        command === "STOP"
          ? "C'est noté : vous ne recevrez plus de messages automatiques de JAMAAL. Vous pouvez toujours nous écrire ici. Pour les réactiver, envoyez START."
          : "Merci ! Les messages JAMAAL (rappels, offres, anniversaire) sont réactivés. Envoyez STOP pour les arrêter.",
    });
    return;
  }

  const limited = await rateLimit(`wa-bot:${msg.phone}`, { limit: 30, windowMs: 3_600_000 });
  if (!limited.ok) return;

  // 3. Équipe (livreur, revendeur, admin).
  if (await automationEnabled("staffWhatsApp")) {
    const staff = await identifyStaff(msg.phone).catch(() => null);
    if (staff?.role === "LIVREUR") {
      if (!text && msg.location) {
        await sendWhatsApp({ to: msg.phone, kind: "bot", free: true, text: "📍 Position reçue : elle sera jointe à votre prochaine étape." });
        return;
      }
      if (!text) return;
      const out = await runLivreurCommand(staff.livreurId, text, msg.location ?? (await lastLocation(msg.phone)));
      await sendWhatsApp({ to: msg.phone, kind: "bot", free: true, text: out });
      return;
    }
    const kit = staff?.role === "CONSULTANT" && text ? text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().match(/^(stop|start|arreter|reprendre) kit\b/) : null;
    if (kit && staff?.role === "CONSULTANT") {
      const onKit = kit[1] === "start" || kit[1] === "reprendre";
      await prisma.consultant.update({ where: { id: staff.consultantId }, data: { kitMatin: onKit } });
      await sendWhatsApp({ to: msg.phone, kind: "bot", free: true, text: onKit ? "C'est noté : vous recevrez le kit du matin à 8 h. ☀️" : "C'est noté : plus de kit du matin. Envoyez « start kit » pour le réactiver." });
      return;
    }
    if (staff && geminiConfigured()) {
      const history = await whatsappHistory(msg.phone);
      if (!history.length || history[history.length - 1].role !== "user") return;
      let answer: string;
      try {
        answer = await runStaffWhatsApp(staff, msg.phone, history);
      } catch (e) {
        console.error("[whatsapp] assistant équipe", e);
        answer = "L'assistant est indisponible pour le moment, réessayez dans un instant ou ouvrez le back-office.";
      }
      await reply(msg.phone, answer, msg.origin);
      return;
    }
  }

  // 4. Client : assistant de commande.
  if (!geminiConfigured() || !(await automationEnabled("whatsappBot"))) return;
  const thread = await prisma.whatsAppThread.findUnique({ where: { phone: msg.phone }, select: { botPausedUntil: true } }).catch(() => null);
  if (thread?.botPausedUntil && thread.botPausedUntil > new Date()) return;

  const history = await whatsappHistory(msg.phone);
  if (msg.location && !text) history.push({ role: "user", text: "(Je vous envoie ma position pour la livraison.)" });
  if (!history.length || history[history.length - 1].role !== "user") return;

  try {
    const res = await runWhatsAppSales({ phone: msg.phone, profileName: msg.profileName, location: msg.location ?? (await lastLocation(msg.phone)), origin: msg.origin }, history);
    await reply(msg.phone, res.text, msg.origin, res.orderPath ? { cta: { label: "Payer ma commande", url: `${msg.origin}${res.orderPath}` } } : {});
  } catch (e) {
    console.error("[whatsapp] assistant", e);
    await sendWhatsApp({ to: msg.phone, kind: "bot", free: true, text: "Merci pour votre message ! Un conseiller JAMAAL vous répond très vite." });
  }
}
