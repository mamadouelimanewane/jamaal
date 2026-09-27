import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ADMIN_ONLY_PREFIXES = [
  "/admin/utilisateurs",
  "/admin/produits",
  "/admin/categories",
  "/admin/commandes",
  "/admin/clients",
  "/admin/consultants",
  "/admin/livreurs",
  "/admin/comptabilite",
  "/admin/statistiques",
  "/admin/blog",
];

const handler = auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/admin/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }
  const isAdminOnlyPath = ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isAdminOnlyPath && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }
  return NextResponse.next();
});

export { handler as proxy };

export const config = {
  matcher: ["/admin/:path*"],
};
