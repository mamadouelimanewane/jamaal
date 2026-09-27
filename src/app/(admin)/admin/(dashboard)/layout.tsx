import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Users,
  Bike,
  BarChart3,
  Wallet,
  Newspaper,
  UserCog,
  Contact,
  Bell,
  Truck,
  Undo2,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResponsiveSidebar } from "@/components/admin/ResponsiveSidebar";

const adminGroups = [
  {
    title: "Aperçu",
    links: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard }],
  },
  {
    title: "Catalogue",
    links: [
      { href: "/admin/produits", label: "Produits & stocks", icon: Package },
      { href: "/admin/categories", label: "Catégories", icon: Tags },
    ],
  },
  {
    title: "Ventes",
    links: [
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/retours", label: "Retours & remboursements", icon: Undo2 },
      { href: "/admin/clients", label: "Clients (CRM)", icon: Contact },
    ],
  },
  {
    title: "Réseau",
    links: [
      { href: "/admin/consultants", label: "Revendeurs / Consultants", icon: Users },
      { href: "/admin/livreurs", label: "Livreurs", icon: Bike },
    ],
  },
  {
    title: "Pilotage",
    links: [
      { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
      { href: "/admin/comptabilite", label: "Comptabilité", icon: Wallet },
    ],
  },
  {
    title: "Contenu",
    links: [{ href: "/admin/blog", label: "Blog", icon: Newspaper }],
  },
];

const consultantLinks = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/mes-commandes", label: "Mes commandes", icon: ShoppingCart },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];

const livreurLinks = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/mes-livraisons", label: "Mes livraisons", icon: Truck },
];

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/login" });
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/admin/login");
  const role = session.user?.role;

  const unreadCount = session.user?.id
    ? await prisma.notification.count({ where: { userId: session.user.id, read: false } })
    : 0;

  const sidebarContent = (
    <>
      <Link href="/admin" className="px-2">
          <p className="font-serif-display text-lg font-semibold text-navy">JAMAAL</p>
          <p className="text-xs text-navy/50">Back-office</p>
        </Link>

        <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
          {role === "ADMIN" &&
            adminGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-navy/40">
                  {group.title}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.links.map((l) => {
                    const Icon = l.icon;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-cream hover:text-navy"
                      >
                        <Icon size={16} />
                        {l.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

          {role === "ADMIN" && (
            <div>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-navy/40">
                Système
              </p>
              <Link
                href="/admin/notifications"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-cream hover:text-navy"
              >
                <Bell size={16} />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-dark px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/admin/utilisateurs"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-cream hover:text-navy"
              >
                <UserCog size={16} />
                Utilisateurs
              </Link>
            </div>
          )}

          {role === "CONSULTANT" && (
            <div className="flex flex-col gap-0.5">
              {consultantLinks.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-cream hover:text-navy"
                  >
                    <Icon size={16} />
                    {l.label}
                    {l.href === "/admin/notifications" && unreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-dark px-1 text-[10px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {role === "LIVREUR" && (
            <div className="flex flex-col gap-0.5">
              {livreurLinks.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-cream hover:text-navy"
                  >
                    <Icon size={16} />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <div className="mt-auto border-t border-line pt-4">
          <p className="px-2 text-xs font-medium text-navy/70">{session.user?.name}</p>
          <p className="px-2 text-xs text-navy/40">{session.user?.email}</p>
          <p className="px-2 text-[10px] uppercase tracking-wide text-rose-dark">{role}</p>
          <form action={logoutAction}>
            <button className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-dark transition hover:bg-cream">
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
    </>
  );

  return <ResponsiveSidebar sidebar={sidebarContent}>{children}</ResponsiveSidebar>;
}
