/**
 * Mise en forme d'une réponse de l'assistant pour WhatsApp (pur) : le Markdown devient la
 * syntaxe WhatsApp (*gras*, _italique_), les liens [texte](/chemin) deviennent « texte : URL ».
 */
export function toWhatsAppText(markdown: string, origin: string): string {
  const abs = (href: string) => (href.startsWith("/") && !href.startsWith("//") ? `${origin}${href}` : href);
  return markdown
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, href: string) => {
      const url = abs(href);
      return text.trim() === url || text.trim() === href ? url : `${text} : ${url}`;
    })
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^#{1,4}\s+(.*)$/gm, "*$1*")
    .replace(/^[ \t]*[-•][ \t]+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 3800);
}

/** Message entrant « STOP » / « START » (désinscription des messages automatiques). */
export function optCommand(text: string): "STOP" | "START" | null {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (["STOP", "STOPP", "ARRET", "ARRETER", "DESABONNER", "UNSUBSCRIBE"].includes(t)) return "STOP";
  if (["START", "REPRENDRE", "ABONNER"].includes(t)) return "START";
  return null;
}

/**
 * Marqueurs que l'assistant peut ajouter à sa réponse (pur, testé) :
 *   [[boutons: Oui | Non | Voir les offres]]  → boutons de réponse rapide (3 au plus)
 *   [[lien: Payer ma commande | /commande/abc]] → bouton qui ouvre un lien
 * Ils sont retirés du texte ; un seul type est envoyé (Meta n'en accepte qu'un par message) :
 * le lien l'emporte sur les boutons.
 */
export function parseReplyMarkers(text: string, origin: string): { text: string; buttons?: string[]; cta?: { label: string; url: string } } {
  let buttons: string[] | undefined;
  let cta: { label: string; url: string } | undefined;
  const clean = text
    .replace(/\[\[\s*boutons?\s*:\s*([^\]]+)\]\]/gi, (_, list: string) => {
      const b = list.split("|").map((s) => s.trim().slice(0, 20)).filter(Boolean).slice(0, 3);
      if (b.length) buttons = b;
      return "";
    })
    .replace(/\[\[\s*lien\s*:\s*([^|\]]+)\|\s*([^\]\s]+)\s*\]\]/gi, (_, label: string, href: string) => {
      const url = href.startsWith("/") && !href.startsWith("//") ? `${origin}${href}` : href;
      if (/^https:\/\//.test(url)) cta = { label: label.trim().slice(0, 20), url };
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: clean || "👇", ...(cta ? { cta } : buttons ? { buttons } : {}) };
}

/** Lien « Commander sur WhatsApp » vers le numéro JAMAAL, message pré-rempli. */
export function waOrderLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
