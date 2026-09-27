import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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
  if (pathname.startsWith("/admin/utilisateurs") && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }
  return NextResponse.next();
});

export { handler as proxy };

export const config = {
  matcher: ["/admin/:path*"],
};
