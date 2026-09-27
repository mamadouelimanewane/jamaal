import { auth } from "@/lib/auth";

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
