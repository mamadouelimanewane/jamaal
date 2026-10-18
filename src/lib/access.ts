/**
 * Accès d'un utilisateur, relu en base à chaque contrôle (jamais fié à la session seule) :
 * rôle actuel, compte actif ou suspendu, profil de privilèges. Fichier serveur.
 */
import { prisma } from "@/lib/prisma";
import { normalizePermissions, type Permissions } from "@/lib/permissions";

export interface Access {
  id: string;
  role: string;
  active: boolean;
  profileId: string | null;
  profileName: string | null;
  /** null = pas de restriction (administrateur complet, ou autre rôle). Objet = administrateur restreint par son profil. */
  perms: Permissions | null;
}

export async function getAccess(userId: string): Promise<Access | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true, profileId: true, profile: { select: { name: true, permissions: true } } },
  });
  if (!u) return null;
  return {
    id: u.id,
    role: u.role,
    active: u.active,
    profileId: u.profileId,
    profileName: u.profile?.name ?? null,
    // Un profil ne restreint que les administrateurs ; un profil introuvable (supprimé) ne donne jamais plus de droits.
    perms: u.role === "ADMIN" && u.profileId ? normalizePermissions(u.profile?.permissions) : null,
  };
}

/** Nombre d'administrateurs complets actifs (sans profil) : il doit toujours en rester un. */
export async function countFullAdmins(excludingUserId?: string): Promise<number> {
  return prisma.user.count({ where: { role: "ADMIN", active: true, profileId: null, ...(excludingUserId ? { id: { not: excludingUserId } } : {}) } });
}
