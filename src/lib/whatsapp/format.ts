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
