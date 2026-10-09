/**
 * Formulaires du back-office envoyés directement à une action serveur : en production, Next.js
 * remplace le message d'une erreur levée par une page « A server error occurred ». On renvoie
 * plutôt sur la page d'origine avec le message dans l'adresse (?erreur=…), affiché par
 * <FormErrorBanner />. Fichier serveur.
 */
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";

export function friendlyError(e: unknown, fallback = "Enregistrement impossible, réessayez."): string {
  const prisma = e instanceof Error && /^PrismaClient/.test(e.constructor.name);
  if (prisma && (e as { code?: string }).code === "P2003") return "Impossible : cet élément est encore utilisé ailleurs (commandes, stock…).";
  if (prisma && (e as { code?: string }).code === "P2002") return "Cette valeur existe déjà (doublon).";
  if (!(e instanceof Error) || prisma) {
    console.error("[formulaire]", e);
    return fallback;
  }
  return e.message;
}

/** Revient sur la page du formulaire avec le message d'erreur. Laisse passer redirect()/notFound(). */
export async function backWithError(e: unknown, fallbackPath = "/admin"): Promise<never> {
  unstable_rethrow(e);
  const msg = friendlyError(e).slice(0, 300);
  let path = fallbackPath;
  try {
    const ref = (await headers()).get("referer");
    if (ref) {
      const u = new URL(ref);
      path = u.pathname + u.search;
    }
  } catch {
    // pas de page d'origine : chemin par défaut
  }
  const u = new URL(path, "http://local");
  u.searchParams.set("erreur", msg);
  redirect(`${u.pathname}?${u.searchParams.toString()}`);
}
