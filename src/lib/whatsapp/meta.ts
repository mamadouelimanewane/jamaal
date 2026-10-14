import type { SendResult } from "./index";

const API = "https://graph.facebook.com/v21.0";

/** Message riche : boutons de réponse (3 au plus), bouton lien, ou image avec légende. */
export interface RichOptions {
  /** Réponse dans la fenêtre de 24 h : pas de modèle, contenu libre (boutons, image…). */
  free?: boolean;
  /** Modèle à utiliser hors fenêtre de 24 h (défaut : WHATSAPP_TEMPLATE_NAME). */
  template?: string;
  /** Variables {{1}}, {{2}}… du modèle (sinon tout le texte devient {{1}}). Utile pour un modèle dédié. */
  templateVars?: string[];
  /** Boutons de réponse rapide (20 caractères au plus chacun). */
  buttons?: string[];
  /** Bouton qui ouvre un lien (ex. « Payer maintenant »). */
  cta?: { label: string; url: string };
  /** Image envoyée par adresse publique (https), le texte devient sa légende. */
  imageUrl?: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Corps de la requête Meta (pur, testé). Hors fenêtre de 24 h, seul un modèle validé passe :
 * le texte (avec le lien éventuel) devient sa variable {{1}}. Dans la fenêtre : texte, boutons,
 * bouton lien ou image.
 */
export function buildMetaPayload(to: string, text: string, opts: RichOptions = {}, envTemplate = process.env.WHATSAPP_TEMPLATE_NAME, lang = process.env.WHATSAPP_TEMPLATE_LANG ?? "fr") {
  const template = opts.free ? undefined : opts.template || envTemplate;
  if (template && opts.template && opts.templateVars?.length) {
    // Modèle dédié : une variable par champ (Meta refuse retours à la ligne et suites d'espaces).
    const parameters = opts.templateVars.map((v) => ({ type: "text", text: v.replace(/\s+/g, " ").trim().slice(0, 200) || "-" }));
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: lang }, components: [{ type: "body", parameters }] },
    };
  }
  if (template) {
    const withLink = opts.cta ? `${text}\n${opts.cta.label} : ${opts.cta.url}` : opts.imageUrl ? `${text}\n${opts.imageUrl}` : text;
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: lang }, components: [{ type: "body", parameters: [{ type: "text", text: withLink.replace(/\s*\n+\s*/g, " ").slice(0, 900) }] }] },
    };
  }
  if (opts.imageUrl) {
    return { messaging_product: "whatsapp", to, type: "image", image: { link: opts.imageUrl, caption: clip(text, 1024) } };
  }
  const buttons = (opts.buttons ?? []).map((b) => b.trim()).filter(Boolean).slice(0, 3);
  if (buttons.length) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: { type: "button", body: { text: clip(text, 1024) }, action: { buttons: buttons.map((b, i) => ({ type: "reply", reply: { id: `b${i + 1}`, title: clip(b, 20) } })) } },
    };
  }
  if (opts.cta) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: { type: "cta_url", body: { text: clip(text, 1024) }, action: { name: "cta_url", parameters: { display_text: clip(opts.cta.label, 20), url: opts.cta.url } } },
    };
  }
  return { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: /https?:\/\//.test(text) } };
}

/**
 * API Cloud de Meta (aussi utilisable avec 360dialog, au même format).
 * - Hors fenêtre de 24 h : message « modèle » (WHATSAPP_TEMPLATE_NAME, texte en variable {{1}}).
 * - Dans la fenêtre (réponse à un client) : texte libre, boutons, bouton lien ou image.
 */
export async function sendViaMeta(to: string, text: string, opts: RichOptions = {}): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const res = await fetch(`${API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildMetaPayload(to, text, opts)),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!res.ok) return { status: "ECHEC", error: `${data.error?.code ?? res.status} ${data.error?.message ?? ""}`.trim().slice(0, 300) };
  return { status: "ENVOYE", providerId: data.messages?.[0]?.id };
}

/** Télécharge un média reçu (vocal, photo) : l'API donne d'abord son adresse, puis le fichier. */
export async function downloadMetaMedia(mediaId: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !/^[\w-]{3,64}$/.test(mediaId)) return null;
  try {
    const meta = await fetch(`${API}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) });
    const info = (await meta.json().catch(() => ({}))) as { url?: string; mime_type?: string; file_size?: number };
    if (!meta.ok || !info.url || (info.file_size ?? 0) > 8 * 1024 * 1024) return null;
    const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (!file.ok) return null;
    return { data: new Uint8Array(await file.arrayBuffer()), mimeType: (info.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream").split(";")[0] };
  } catch {
    return null;
  }
}
