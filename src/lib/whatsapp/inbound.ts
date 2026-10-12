/**
 * Traitement d'un message WhatsApp reçu : STOP / START (messages automatiques), puis réponse de
 * l'assistant de commande. L'assistant se tait si un conseiller JAMAAL a écrit lui-même à ce
 * client dans les 2 dernières heures (reprise de la conversation par un humain).
 */
import { prisma } from "@/lib/prisma";
import { setPhoneOptOut } from "@/lib/phone-match";
import { rateLimit } from "@/lib/rate-limit";
import { geminiConfigured } from "@/lib/ai/gemini";
import { automationEnabled } from "@/lib/automation-settings";
import { runWhatsAppSales, whatsappHistory } from "@/lib/ai/whatsapp-sales";
import { sendWhatsApp } from "./index";
import { optCommand, toWhatsAppText } from "./format";

export interface InboundMessage {
  phone: string;
  text: string | null;
  location: { lat: number; lng: number } | null;
  profileName: string | null;
  origin: string;
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

export async function handleInboundWhatsApp(msg: InboundMessage): Promise<void> {
  const command = msg.text ? optCommand(msg.text) : null;
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

  if (!geminiConfigured() || !(await automationEnabled("whatsappBot"))) return;
  const human = await prisma.whatsAppMessage.findFirst({
    where: { toNumber: msg.phone, direction: "OUT", kind: { in: ["client", "test"] }, createdAt: { gte: new Date(Date.now() - 2 * 3_600_000) } },
    select: { id: true },
  });
  if (human) return;
  const limited = await rateLimit(`wa-bot:${msg.phone}`, { limit: 30, windowMs: 3_600_000 });
  if (!limited.ok) return;

  const history = await whatsappHistory(msg.phone);
  if (msg.location && !msg.text) history.push({ role: "user", text: "(Je vous envoie ma position pour la livraison.)" });
  if (!history.length || history[history.length - 1].role !== "user") return;

  let reply: string;
  try {
    reply = await runWhatsAppSales({ phone: msg.phone, profileName: msg.profileName, location: msg.location ?? (await lastLocation(msg.phone)), origin: msg.origin }, history);
  } catch (e) {
    console.error("[whatsapp] assistant", e);
    reply = "Merci pour votre message ! Un conseiller JAMAAL vous répond très vite.";
  }
  await sendWhatsApp({ to: msg.phone, text: toWhatsAppText(reply, msg.origin), kind: "bot", free: true });
}
