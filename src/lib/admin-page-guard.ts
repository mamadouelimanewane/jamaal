import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Garde serveur des pages réservées à l'administrateur (en plus du proxy). */
export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");
  return session;
}
