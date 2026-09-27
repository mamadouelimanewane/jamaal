import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

const links = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/consultants", label: "Consultants" },
  { href: "/admin/blog", label: "Blog" },
];

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/login" });
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/admin/login");
  const isAdmin = session.user?.role === "ADMIN";

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-white px-4 py-6">
        <p className="font-serif-display px-2 text-lg font-semibold text-navy">JAMAAL</p>
        <p className="mb-6 px-2 text-xs text-navy/50">Back-office</p>
        <nav className="flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-cream hover:text-navy"
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin/utilisateurs"
              className="rounded-lg px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-cream hover:text-navy"
            >
              Utilisateurs
            </Link>
          )}
        </nav>

        <div className="mt-auto border-t border-line pt-4">
          <p className="px-2 text-xs text-navy/50">{session.user?.email}</p>
          <p className="px-2 text-xs text-navy/40">{session.user?.role}</p>
          <form action={logoutAction}>
            <button className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-dark transition hover:bg-cream">
              Se déconnecter
            </button>
          </form>
          <Link
            href="/"
            className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-navy/50 transition hover:bg-cream"
          >
            ← Retour au site
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto px-8 py-8">{children}</main>
    </div>
  );
}
