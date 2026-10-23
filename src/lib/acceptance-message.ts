/**
 * Message WhatsApp d'acceptation d'une candidature (ouvert depuis le téléphone de l'admin). Pur, testé.
 * Le numéro est mis au format international (77… → 22177…) : sinon WhatsApp ne trouve pas le destinataire.
 */
import { canonicalizePhone } from "@/lib/phone";

/** Page d'installation de l'application, qui mène ensuite à l'activation (même site que le lien d'activation). */
export function installUrl(activationUrl: string): string | null {
  try {
    const u = new URL(activationUrl);
    return `${u.origin}/admin/installer?suite=${encodeURIComponent(u.pathname + u.search)}`;
  } catch {
    return null;
  }
}

export function acceptanceMessage(r: { name: string; sponsorName: string | null; activationUrl: string; shopUrl: string | null }): string {
  const first = r.name.trim().split(/\s+/)[0] || r.name;
  return [
    `Bonjour ${first}, bonne nouvelle : votre candidature JAMAAL est acceptée ! 🎉`,
    r.sponsorName ? `Vous rejoignez l'équipe de ${r.sponsorName}.` : "",
    "",
    `1️⃣ Activez votre espace et choisissez votre mot de passe (lien valable 7 jours) : ${r.activationUrl}`,
    installUrl(r.activationUrl) ? `2️⃣ Installez l'application JAMAAL sur votre téléphone (icône sur l'écran d'accueil) : ${installUrl(r.activationUrl)}` : "",
    r.shopUrl ? `3️⃣ Votre lien de vente personnel : ${r.shopUrl}` : "",
    "",
    "Une question ? Répondez simplement à ce message.",
  ]
    .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""))
    .join("\n");
}

export function acceptanceWhatsAppUrl(r: { name: string; phone: string; sponsorName: string | null; activationUrl: string; shopUrl: string | null }): string | undefined {
  const number = canonicalizePhone(r.phone);
  return number.length >= 8 ? `https://wa.me/${number}?text=${encodeURIComponent(acceptanceMessage(r))}` : undefined;
}
