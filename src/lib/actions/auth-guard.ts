import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireStaff() {
  const session = await auth();
  if (!session) throw new Error("Non authentifié");
  return session;
}

export async function requireAdmin() {
  const session = await requireStaff();
  if (session.user?.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  return session;
}

export async function requireConsultantProfile() {
  const session = await requireStaff();
  if (!session.user?.id) throw new Error("Session invalide");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { consultant: true },
  });
  if (!user?.consultant) throw new Error("Aucun profil consultant lié à ce compte");
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
