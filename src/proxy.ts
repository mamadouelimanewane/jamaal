import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { INVITE_COOKIE, INVITE_MAX_AGE, inviteCode } from "@/lib/invite-lock";
import { guardRequest, guardResponse } from "@/lib/bot-guard-store";
import { clientIpFromHeaders } from "@/lib/rate-limit";
import { legacyRedirect } from "@/lib/domain-redirect";
import { LOCALE_COOKIE, LOCALE_HEADER, PATH_HEADER, isLocalizablePath, localizeHref, splitLocale } from "@/lib/i18n/config";

const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

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
  "/admin/kit-marketing",
  "/admin/reservations",
  "/admin/primes-equipe",
  "/admin/protocole",
  "/admin/wallets",
  "/admin/coupons",
  "/admin/reglages",
  "/admin/modele-economique",
  "/admin/versements",
  "/admin/livraisons",
  "/admin/automatisations",
  "/admin/offres",
  "/admin/defis",
  "/admin/avis",
  "/admin/protection",
  "/admin/skin-advisor",
];

/**
 * Proxy Next.js 16 :
 * 0. Robot anti-aspiration : refuse les aspirateurs et freine les copies massives du site
 * 1. Pose le cookie jamaal_ref si ?ref=slug est présent
 * 2. Protège les routes /admin (logique existante)
 */
const handler = auth(async (req) => {
  const { pathname, searchParams } = req.nextUrl;

  // ——— Ancienne adresse → www.jamaal.sn (pages seulement ; API et webhooks inchangés) ———
  const moved = legacyRedirect(req.headers.get("x-forwarded-host") ?? req.headers.get("host"), req.method, pathname, req.nextUrl.search);
  if (moved) return NextResponse.redirect(moved, 308);

  // ——— Robot anti-aspiration (src/lib/bot-guard.ts) ———
  // Les membres connectés (équipe, revendeurs, livreurs) ne sont jamais freinés.
  if (!req.auth) {
    const verdict = await guardRequest({ method: req.method, pathname, headers: req.headers, ip: clientIpFromHeaders(req.headers) });
    if (verdict.action !== "allow") return guardResponse(verdict);
  }

  // ——— Langue du site vitrine : /it/… = italien (réécrit vers la page française, langue passée en en-tête) ———
  const { locale, path: basePath } = splitLocale(pathname);
  const localizable = isLocalizablePath(basePath);
  const cookieLang = req.cookies.get(LOCALE_COOKIE)?.value;
  const langParam = searchParams.get("lang");
  if (req.method === "GET" && localizable) {
    // Retour au français demandé (sélecteur FR) : on mémorise et on nettoie l'adresse.
    if (langParam === "fr" || langParam === "it") {
      const url = req.nextUrl.clone();
      url.searchParams.delete("lang");
      url.pathname = langParam === "it" ? localizeHref(basePath, "it") : basePath;
      const res = NextResponse.redirect(url, 307);
      res.cookies.set(LOCALE_COOKIE, langParam, { path: "/", maxAge: LOCALE_MAX_AGE, sameSite: "lax" });
      return res;
    }
    // Visiteur qui a choisi l'italien : les adresses françaises le mènent à la page italienne.
    if (locale === "fr" && cookieLang === "it") {
      const url = req.nextUrl.clone();
      url.pathname = localizeHref(pathname, "it");
      return NextResponse.redirect(url, 307);
    }
  }
  if (locale === "it" && !localizable) {
    const url = req.nextUrl.clone();
    url.pathname = basePath;
    return NextResponse.redirect(url, 308);
  }
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set(LOCALE_HEADER, locale);
  reqHeaders.set(PATH_HEADER, basePath);
  let response: NextResponse;
  if (locale === "it") {
    const url = req.nextUrl.clone();
    url.pathname = basePath;
    response = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
    if (cookieLang !== "it") response.cookies.set(LOCALE_COOKIE, "it", { path: "/", maxAge: LOCALE_MAX_AGE, sameSite: "lax" });
  } else {
    response = NextResponse.next({ request: { headers: reqHeaders } });
  }
  // Signale aux robots d'IA que le contenu ne doit pas servir à l'entraînement ni être recopié.
  if (!pathname.startsWith("/api/")) response.headers.set("X-Robots-Tag", pathname.startsWith("/admin") ? "noindex, nofollow, noai, noimageai" : "noai, noimageai");

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

  // ——— Lien d'invitation d'un revendeur : code de parrainage fixé (cookie httpOnly, imposé à la candidature) ———
  const invite = basePath === "/devenir-consultant" ? inviteCode(searchParams.get("ref")) : "";
  if (invite) {
    response.cookies.set(INVITE_COOKIE, invite, { path: "/", maxAge: INVITE_MAX_AGE, sameSite: "lax", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
  }

  // ——— Protection admin (inchangée) ———
  if (!pathname.startsWith("/admin")) return response;

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/admin/login";
  const isRecoveryPage = pathname === "/admin/forgot-password" || pathname === "/admin/reset-password" || pathname === "/admin/acces" || pathname === "/admin/installer" || pathname === "/admin/livreur" || pathname === "/admin/sw.js" || pathname === "/admin/deconnexion";

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
