"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "./auth-guard";

// Pas d'export : un fichier "use server" ne peut exporter que des fonctions asynchrones.
const VIEW_AS_COOKIE = "jamaal_viewas";

/** L'admin consulte l'espace d'un consultant (lecture de ses pages, sans connaître son mot de passe). */
export async function startViewAsReseller(consultantId: string) {
  await requireAdmin();
  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, consultantId, { path: "/admin", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 2 });
  redirect("/admin/mes-ventes");
}

export async function stopViewAsReseller() {
  await requireAdmin();
  const jar = await cookies();
  jar.delete({ name: VIEW_AS_COOKIE, path: "/admin" });
  redirect("/admin/consultants");
}
