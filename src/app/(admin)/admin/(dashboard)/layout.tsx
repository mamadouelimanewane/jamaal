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
  Settings,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResponsiveSidebar } from "@/components/admin/ResponsiveSidebar";
import { SidebarNavLink } from "@/components/admin/SidebarNavLink";

import { GlobalSearch } from "@/components/admin/GlobalSearch";

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
  { href: "/admin/mon-kit-marketing", label: "Mon Kit Marketing", icon: Newspaper },
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
        <p className="font-serif-display text-lg font-semibold tracking-wide text-white">JAMAAL</p>
        <p className="text-xs text-white/40">Back-office</p>
      </Link>

      <div className="mt-4 px-1">
        <GlobalSearch />
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
        {role === "ADMIN" &&
          adminGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {group.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.links.map((l) => (
                  <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={16} />} />
                ))}
              </div>
            </div>
          ))}

        {role === "ADMIN" && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              Système
            </p>
            <div className="flex flex-col gap-0.5">
              <SidebarNavLink href="/admin/notifications" label="Notifications" icon={<Bell size={16} />} badge={unreadCount} />
              <SidebarNavLink href="/admin/utilisateurs" label="Utilisateurs" icon={<UserCog size={16} />} />
              <SidebarNavLink href="/admin/reglages" label="Réglages & Fidélité" icon={<Settings size={16} />} />
            </div>
          </div>
        )}

        {role === "CONSULTANT" && (
          <div className="flex flex-col gap-0.5">
            {consultantLinks.map((l) => (
              <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={16} />} />
            ))}
            <SidebarNavLink href="/admin/notifications" label="Notifications" icon={<Bell size={16} />} badge={unreadCount} />
          </div>
        )}

        {role === "LIVREUR" && (
          <div className="flex flex-col gap-0.5">
            {livreurLinks.map((l) => (
              <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={16} />} />
            ))}
          </div>
        )}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="px-2 text-xs font-medium text-white/80">{session.user?.name}</p>
        <p className="px-2 text-xs text-white/40">{session.user?.email}</p>
        <p className="px-2 text-[10px] uppercase tracking-wide text-rose">{role}</p>
        <form action={logoutAction}>
          <button className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-light transition hover:bg-white/5">
            Se déconnecter
          </button>
        </form>
        <Link
          href="/"
          className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-white/40 transition hover:bg-white/5 hover:text-white/70"
        >
          ← Retour au site
        </Link>
      </div>
    </>
  );

  return <ResponsiveSidebar sidebar={sidebarContent}>{children}</ResponsiveSidebar>;
}
