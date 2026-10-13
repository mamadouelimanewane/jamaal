/**
 * Retrouver le compte d'un membre de l'équipe à partir d'un numéro de téléphone, quel que soit
 * l'endroit où le numéro est enregistré : sur le compte (User.phone), sur la fiche revendeur
 * (Consultant.whatsapp) ou sur la fiche livreur (Livreur.phone). Comparaison sur les 9 derniers
 * chiffres : « 77 123 45 67 », « +221771234567 », « 00221 77… » désignent le même numéro.
 *
 * Cause n° 1 des connexions refusées : un revendeur dont le compte a été créé avec un e-mail
 * n'avait AUCUN téléphone sur son compte ; il tapait son numéro WhatsApp et la connexion échouait.
 */
import { prisma } from "@/lib/prisma";
import { phoneTail } from "@/lib/phone-match";

export interface StaffCandidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  passwordHash: string;
  /** Numéro WhatsApp où joindre la personne (compte, fiche revendeur ou livreur). */
  whatsapp: string | null;
}

/** Comptes possibles pour ce numéro, équipe d'abord (un client au même numéro passe après). */
export async function accountsByPhone(raw: string): Promise<StaffCandidate[]> {
  const tail = phoneTail(raw);
  if (!tail) return [];
  const rows = await prisma.$queryRaw<(StaffCandidate & { rank: number })[]>`
    SELECT u.id, u.name, u.email, u.phone, u.role::text AS role, u."passwordHash", u.phone AS whatsapp, CASE WHEN u.role::text = 'CLIENT' THEN 3 ELSE 0 END AS rank
      FROM "User" u WHERE right(regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g'), 9) = ${tail}
    UNION ALL
    SELECT u.id, u.name, u.email, u.phone, u.role::text, u."passwordHash", c.whatsapp, 1
      FROM "Consultant" c JOIN "User" u ON u."consultantId" = c.id
      WHERE right(regexp_replace(c.whatsapp, '[^0-9]', '', 'g'), 9) = ${tail}
    UNION ALL
    SELECT u.id, u.name, u.email, u.phone, u.role::text, u."passwordHash", l.phone, 2
      FROM "Livreur" l JOIN "User" u ON u."livreurId" = l.id
      WHERE right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 9) = ${tail}
    ORDER BY rank LIMIT 6`;
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role, passwordHash: r.passwordHash, whatsapp: r.whatsapp }));
}

/** Compte de l'équipe (hors clients) pour ce numéro. */
export async function staffAccountByPhone(raw: string): Promise<StaffCandidate | null> {
  return (await accountsByPhone(raw)).find((a) => a.role !== "CLIENT") ?? null;
}
