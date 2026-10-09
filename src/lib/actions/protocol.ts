"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { getReseller } from "@/lib/reseller";
import { clientIpFromHeaders } from "@/lib/rate-limit";
import { fillProtocol, pieceLabel } from "@/lib/protocol";
import { getProtocol, saveProtocol, textHash } from "@/lib/protocol-store";

export type ProtocolActionResult = { ok: boolean; message?: string; error?: string; signatureId?: string };

/** Admin : nouveau texte du protocole (nouvelle version si le texte change). */
export async function saveProtocolAction(_prev: ProtocolActionResult, formData: FormData): Promise<ProtocolActionResult> {
  const session = await requireAdmin();
  const text = String(formData.get("text") ?? "").replace(/\r\n/g, "\n").trim();
  if (text.length < 200) return { ok: false, error: "Le protocole semble incomplet (200 caractères au minimum)." };
  if (text.length > 60_000) return { ok: false, error: "Texte trop long (60 000 caractères au maximum)." };
  const before = await getProtocol();
  const doc = await saveProtocol(text);
  await logActivity(session, `Protocole de partenariat enregistré (version ${doc.version})`, "Setting");
  revalidatePath("/admin/protocole");
  revalidatePath("/devenir-consultant");
  return { ok: true, message: doc.version === before.version ? "Aucun changement de texte." : `Version ${doc.version} enregistrée : elle s'applique aux nouvelles candidatures, et les membres sont invités à la signer.` };
}

/** Membre déjà en place : signe la version en vigueur depuis son espace. */
export async function signProtocolAction(_prev: ProtocolActionResult, formData: FormData): Promise<ProtocolActionResult> {
  const me = await getReseller();
  if (!me) return { ok: false, error: "Réservé aux membres du réseau." };
  if (me.viewAs) return { ok: false, error: "Mode consultation : signature impossible à la place du membre." };
  if (formData.get("accept") !== "on") return { ok: false, error: "Cochez « Lu et approuvé »." };
  const m = String(formData.get("signature") ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  const image = m ? Buffer.from(m[1], "base64") : null;
  if (!image || image.length < 400 || image.length > 400_000 || image.readUInt32BE(0) !== 0x89504e47) return { ok: false, error: "Signez dans le cadre prévu." };
  const protocol = await getProtocol();
  if (Number(formData.get("version")) !== protocol.version) return { ok: false, error: "Le protocole vient d'être mis à jour : rechargez la page." };
  const c = await prisma.consultant.findUnique({ where: { id: me.id }, select: { name: true, whatsapp: true, address: true, idType: true, idNumber: true, sponsor: { select: { slug: true } } } });
  if (!c) return { ok: false, error: "Profil introuvable." };
  const text = fillProtocol(protocol.text, { nom: c.name, piece: pieceLabel(c.idType, c.idNumber), adresse: c.address ?? "", telephone: c.whatsapp, code_parrain: c.sponsor?.slug ?? "" });
  const h = await headers();
  const sig = await prisma.protocolSignature.create({
    data: {
      version: protocol.version, text, textHash: textHash(text), signerName: c.name, idType: c.idType, idNumber: c.idNumber, address: c.address, phone: c.whatsapp,
      image: new Uint8Array(image), ip: clientIpFromHeaders(h), userAgent: (h.get("user-agent") ?? "").slice(0, 300) || null, consultantId: me.id,
    },
  });
  revalidatePath("/admin/mon-protocole");
  revalidatePath("/admin/mon-profil");
  return { ok: true, message: "Protocole signé. Votre exemplaire PDF est disponible.", signatureId: sig.id };
}
