/**
 * Diagnostic des envois WhatsApp : traduit les erreurs de Meta en cause et solution, en français. Pur, testé.
 * (Les erreurs sont enregistrées dans le journal sous la forme « code message ».)
 */
export type Diagnosis = { code: string; cause: string; fix: string };

const KNOWN: Record<string, Omit<Diagnosis, "code">> = {
  "131047": {
    cause: "Message hors de la fenêtre de 24 h : le client n'a pas écrit à JAMAAL depuis plus de 24 h, et Meta n'accepte alors qu'un modèle validé.",
    fix: "Créez un modèle « Utilitaire » avec une seule variable {{1}} dans WhatsApp Manager, attendez sa validation, puis renseignez WHATSAPP_TEMPLATE_NAME (et WHATSAPP_TEMPLATE_LANG, ex. fr) dans Vercel et redéployez.",
  },
  "131030": {
    cause: "Numéro de test Meta : seuls les numéros ajoutés à la liste de l'application peuvent recevoir des messages.",
    fix: "Ajoutez le numéro dans Meta for Developers › WhatsApp › Configuration de l'API (5 numéros au plus), ou passez sur le vrai numéro de JAMAAL.",
  },
  "132000": { cause: "Le nombre de variables du modèle ne correspond pas : JAMAAL envoie une seule variable {{1}}.", fix: "Utilisez un modèle dont le texte contient exactement une variable {{1}} (ou créez-en un)." },
  "132001": { cause: "Modèle introuvable dans cette langue.", fix: "Vérifiez l'orthographe exacte de WHATSAPP_TEMPLATE_NAME et la langue WHATSAPP_TEMPLATE_LANG (fr, fr_FR…) telles qu'affichées dans WhatsApp Manager." },
  "132012": { cause: "Format de variable refusé par le modèle.", fix: "Le modèle doit attendre du texte simple dans {{1}} (pas de date, devise ou média)." },
  "132015": { cause: "Modèle mis en pause par Meta (qualité trop basse).", fix: "Modifiez le texte du modèle ou créez-en un nouveau dans WhatsApp Manager." },
  "132016": { cause: "Modèle désactivé par Meta.", fix: "Créez un nouveau modèle et mettez à jour WHATSAPP_TEMPLATE_NAME." },
  "190": { cause: "Jeton d'accès expiré ou invalide (les jetons temporaires durent 24 h).", fix: "Créez un jeton permanent (utilisateur système dans Meta Business › Utilisateurs système), mettez-le dans WHATSAPP_TOKEN et redéployez." },
  "10": { cause: "Le jeton n'a pas la permission d'envoyer des messages.", fix: "Donnez au jeton les permissions whatsapp_business_messaging et whatsapp_business_management." },
  "200": { cause: "Permission refusée par Meta.", fix: "Vérifiez que l'utilisateur système a accès au compte WhatsApp Business et au numéro." },
  "131042": { cause: "Problème de paiement du compte WhatsApp Business.", fix: "Ajoutez un moyen de paiement valide dans Meta Business › Facturation WhatsApp." },
  "133010": { cause: "Le numéro d'envoi n'est pas enregistré sur l'API WhatsApp.", fix: "Terminez l'enregistrement du numéro dans WhatsApp Manager (code PIN à deux étapes)." },
  "131026": { cause: "Message non distribuable : le destinataire n'a pas WhatsApp, ou une version trop ancienne.", fix: "Vérifiez le numéro du client ; rien à corriger côté JAMAAL." },
  "131056": { cause: "Trop de messages envoyés au même numéro en peu de temps.", fix: "Patientez quelques minutes avant de réessayer." },
  "130429": { cause: "Limite de débit de Meta atteinte.", fix: "Les envois reprendront d'eux-mêmes ; étalez les campagnes." },
  "131048": { cause: "Limite d'envoi du numéro (qualité ou palier de messagerie).", fix: "Consultez la qualité du numéro dans WhatsApp Manager ; envoyez moins de messages non sollicités." },
  "368": { cause: "Compte temporairement bloqué par Meta pour non-respect des règles.", fix: "Consultez les alertes dans Meta Business Suite." },
  "131031": { cause: "Compte WhatsApp Business verrouillé.", fix: "Consultez les alertes dans Meta Business Suite et WhatsApp Manager." },
  "100": { cause: "Paramètre invalide dans la requête (souvent le numéro d'envoi WHATSAPP_PHONE_NUMBER_ID).", fix: "Vérifiez WHATSAPP_PHONE_NUMBER_ID (l'identifiant du numéro, pas le numéro lui-même)." },
};

/** Code d'erreur Meta en tête du message enregistré (« 131047 Re-engagement message »). */
export function errorCode(error: string | null | undefined): string | null {
  const m = (error ?? "").trim().match(/^\(?#?(\d{2,6})\)?/);
  return m ? m[1] : null;
}

/** Anciennes erreurs enregistrées sans code (seulement le titre de Meta). */
const TITLES: [RegExp, string][] = [
  [/re-?engagement|24 ?hour|outside.*window/i, "131047"],
  [/not in (the )?allowed list|allowed list/i, "131030"],
  [/number of (localizable_)?param/i, "132000"],
  [/template name does not exist|does not exist in the translation/i, "132001"],
  [/access token|session has expired|error validating access token/i, "190"],
  [/undeliverable/i, "131026"],
  [/payment/i, "131042"],
  [/not registered/i, "133010"],
];

export function diagnose(error: string | null | undefined): Diagnosis {
  const code = errorCode(error) ?? TITLES.find(([re]) => re.test(error ?? ""))?.[1] ?? null;
  if (code && KNOWN[code]) return { code, ...KNOWN[code] };
  if (/num[ée]ro invalide/i.test(error ?? "")) return { code: "numero", cause: "Numéro du destinataire invalide ou incomplet.", fix: "Corrigez le numéro (format 77 123 45 67 ou +221…) sur la fiche du client ou du revendeur." };
  if (/timeout|aborted|fetch failed/i.test(error ?? "")) return { code: "reseau", cause: "Meta n'a pas répondu à temps.", fix: "Problème passager : réessayez." };
  return { code: code ?? "autre", cause: error?.slice(0, 160) || "Erreur inconnue.", fix: "Consultez le détail dans WhatsApp Manager ou envoyez un message de test ci-dessus." };
}

/** Regroupe les échecs par cause, du plus fréquent au moins fréquent. */
export function groupFailures(rows: { error: string | null; createdAt: Date }[]): (Diagnosis & { count: number; last: Date })[] {
  const map = new Map<string, Diagnosis & { count: number; last: Date }>();
  for (const r of rows) {
    const d = diagnose(r.error);
    const cur = map.get(d.code);
    if (cur) {
      cur.count += 1;
      if (r.createdAt > cur.last) cur.last = r.createdAt;
    } else map.set(d.code, { ...d, count: 1, last: r.createdAt });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Date d’il y a n jours (période du diagnostic). */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
