import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const REF_COOKIE = "jamaal_ref";
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

const ADMIN_ONLY_PREFIXES = [
  "/admin/utilisateurs",
  "/admin/produits",
  "/admin/categories",
  "/admin/commandes",
  "/admin/clients",
  "/admin/consultants",
  "/admin/candidatures",
  "/admin/messages",
  "/admin/annonces",
  "/admin/whatsapp",
  "/admin/journal-whatsapp",
  "/admin/livreurs",
  "/admin/comptabilite",
  "/admin/statistiques",
  "/admin/blog",
  "/admin/retours",
  "/admin/historique",
  "/admin/stocks",
  "/admin/accueil",
  "/admin/reservations",
  "/admin/primes-equipe",
  "/admin/protocole",
  "/admin/coupons",
  "/admin/reglages",
  "/admin/modele-economique",
  "/admin/versements",
  "/admin/livraisons",
];

/**
 * Proxy Next.js 16 :
 * 1. Pose le cookie jamaal_ref si ?ref=slug est présent
 * 2. Protège les routes /admin (logique existante)
 */
const handler = auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
  const response = NextResponse.next();

  // ——— Attribution consultant via ?ref= ———
  // Le lien personnel /c/<slug> pose aussi le cookie ici : une page serveur n'a pas le droit
  // d'écrire un cookie (Next.js renvoie une erreur 500), contrairement au proxy.
  const personalLink = pathname.match(/^\/c\/([a-z0-9-]{2,48})\/?$/i)?.[1];
  const ref = searchParams.get("ref") ?? personalLink ?? null;
  if (ref && /^[a-z0-9-]{2,48}$/i.test(ref)) {
    response.cookies.set(REF_COOKIE, ref.toLowerCase(), {
      path: "/",
      maxAge: REF_MAX_AGE,
      sameSite: "lax",
      httpOnly: false, // lisible côté client pour préremplir le select
    });
  }

  // ——— Protection admin (inchangée) ———
  if (!pathname.startsWith("/admin")) return response;

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/admin/login";
  const isRecoveryPage = pathname === "/admin/forgot-password" || pathname === "/admin/reset-password" || pathname === "/admin/acces" || pathname === "/admin/sw.js";

  if (!isLoggedIn && !isLoginPage && !isRecoveryPage) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }
  const isAdminOnlyPath = ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isAdminOnlyPath && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return response;
});

export { handler as proxy };

export const config = {
  // On élargit le matcher pour capturer aussi ?ref= sur le site public
  matcher: ["/admin/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
