/**
 * Code de parrainage reçu par lien d'invitation (/devenir-consultant?ref=…) : il est fixé et ne peut pas être
 * changé par la personne invitée. Le proxy le mémorise dans un cookie httpOnly (illisible et non modifiable
 * depuis la page) ; la candidature l'impose côté serveur, quel que soit le contenu du formulaire. Pur, testé.
 */
export const INVITE_COOKIE = "jamaal_parrain";
export const INVITE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

const CODE = /^[a-z0-9-]{2,48}$/;

/** Code d'invitation valide (minuscules), ou "" s'il est absent ou mal formé. */
export function inviteCode(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  return CODE.test(v) ? v : "";
}

/** Code retenu pour la candidature : celui de l'invitation s'il existe, sinon celui saisi. */
export function effectiveSponsorCode(invite: string | null | undefined, typed: string): string {
  return inviteCode(invite) || typed;
}
