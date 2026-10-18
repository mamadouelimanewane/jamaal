import { auth } from "./auth";
import { getAccess } from "./access";
import { allows, type Level, type ModuleId } from "./permissions";

/**
 * Garde des routes API d'administration : 403 si l'appelant n'est pas administrateur actif ou si son profil
 * n'accorde pas le module. Sans module, la route est réservée à l'administrateur complet.
 */
export async function requireAdminForApi(module?: ModuleId, level: Level = "read") {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.id) return new Response("Forbidden", { status: 403 });
  const access = await getAccess(session.user.id);
  if (!access || !access.active || access.role !== "ADMIN" || !allows(access.perms, module, level)) return new Response("Forbidden", { status: 403 });
  return null;
}
