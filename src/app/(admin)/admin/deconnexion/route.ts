import { signOut } from "@/lib/auth";

/**
 * Coupe la session puis renvoie vers la connexion. Utilisée quand un compte est suspendu ou que ses droits ont changé
 * (une redirection directe vers la connexion bouclerait : un utilisateur connecté en est renvoyé vers le tableau de bord).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const motif = new URL(req.url).searchParams.get("motif") === "suspendu" ? "suspendu" : "session";
  await signOut({ redirect: false });
  return Response.redirect(new URL(`/admin/login?${motif}=1`, req.url), 303);
}
