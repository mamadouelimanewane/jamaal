import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAccess } from "@/lib/access";
import { allows, type Level, type ModuleId } from "@/lib/permissions";

/**
 * Garde serveur des pages réservées à l'administrateur (en plus du proxy). Relit le rôle, le statut et le profil
 * en base. Sans module, la page est réservée à l'administrateur complet (refus par défaut pour un profil restreint).
 */
export async function requireAdminPage(module?: ModuleId, level: Level = "read") {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  const access = await getAccess(session.user.id);
  if (!access || !access.active) redirect("/admin/deconnexion?motif=suspendu");
  if (access.role !== "ADMIN") redirect("/admin");
  if (!allows(access.perms, module, level)) redirect(`/admin?refus=${module ?? "reserve"}`);
  return session;
}

/** Garde de module : à poser dans le layout de chaque dossier d'administration rattaché à un module. */
export const requireModulePage = (module: ModuleId) => requireAdminPage(module, "read");
