import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { repairConsultantLink } from "@/lib/account-link";
import { getAccess } from "@/lib/access";
import { allows, type Level, type ModuleId } from "@/lib/permissions";

/** Rôles de l'équipe JAMAAL (back-office) : exclut explicitement les comptes clients. */
const STAFF_ROLES = new Set(["ADMIN", "CONSULTANT", "LIVREUR"]);

export async function requireStaff() {
  const session = await auth();
  if (!session) throw new Error("Non authentifié");
  if (!STAFF_ROLES.has(session.user?.role ?? "")) throw new Error("Réservé à l'équipe JAMAAL");
  // Rôle et statut relus en base : un compte suspendu ou dont le rôle a changé perd l'accès immédiatement.
  const access = session.user?.id ? await getAccess(session.user.id) : null;
  if (!access) throw new Error("Session invalide : reconnectez-vous.");
  if (!access.active) throw new Error("Compte suspendu : contactez l'administrateur.");
  if (access.role !== session.user?.role) throw new Error("Vos droits ont changé : reconnectez-vous.");
  return session;
}

/**
 * Administrateur actif. Un administrateur restreint (profil de privilèges) doit avoir le module demandé au niveau
 * demandé ; sans module indiqué, l'opération est réservée à l'administrateur complet (refus par défaut).
 */
export async function requireAdmin(module?: ModuleId, level: Level = "write") {
  const session = await requireStaff();
  if (session.user?.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  const access = await getAccess(session.user.id);
  if (!allows(access?.perms ?? null, module, level)) throw new Error("Accès refusé : votre profil n'autorise pas cette opération.");
  return session;
}

export async function requireConsultantProfile() {
  const session = await requireStaff();
  if (!session.user?.id) throw new Error("Session invalide");
  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { consultant: true },
  });
  if (user && !user.consultant && (await repairConsultantLink(user.id))) {
    user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { consultant: true } });
  }
  if (!user?.consultant) throw new Error("Votre compte n'est pas encore rattaché à une fiche revendeur : l'équipe JAMAAL a été prévenue.");
  return { session, consultant: user.consultant };
}

export async function requireLivreurProfile() {
  const session = await requireStaff();
  if (!session.user?.id) throw new Error("Session invalide");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { livreur: true },
  });
  if (!user?.livreur) throw new Error("Aucun profil livreur lié à ce compte");
  return { session, livreur: user.livreur };
}
