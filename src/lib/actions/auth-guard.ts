import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { repairConsultantLink } from "@/lib/account-link";

/** Rôles de l'équipe JAMAAL (back-office) : exclut explicitement les comptes clients. */
const STAFF_ROLES = new Set(["ADMIN", "CONSULTANT", "LIVREUR"]);

export async function requireStaff() {
  const session = await auth();
  if (!session) throw new Error("Non authentifié");
  if (!STAFF_ROLES.has(session.user?.role ?? "")) throw new Error("Réservé à l'équipe JAMAAL");
  return session;
}

/** Session d'un compte client (espace /compte), rattachée à sa fiche Customer. */
export async function requireClient() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  if (session.user.role !== "CLIENT") throw new Error("Réservé aux clients");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { customer: true } });
  if (!user?.customer) throw new Error("Votre compte n'est pas encore rattaché à une fiche client.");
  return { session, customer: user.customer };
}

export async function requireAdmin() {
  const session = await requireStaff();
  if (session.user?.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
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
