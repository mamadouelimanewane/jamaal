import Link from "next/link";
import { cookies } from "next/headers";
import { stopViewAsReseller } from "@/lib/actions/view-as";
import { redirect } from "next/navigation";
import { Calculator,
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
  ClipboardList,
  Mail,
  Banknote,
  Megaphone,
  UserCircle,
  Share2,
  UsersRound,
  GalleryHorizontal,
  CalendarClock,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResponsiveSidebar } from "@/components/admin/ResponsiveSidebar";
import { SidebarNavLink } from "@/components/admin/SidebarNavLink";

import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { InstallApp } from "@/components/admin/InstallApp";

const adminGroups = [
  {
    title: "Aperçu",
    links: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard }],
  },
  {
    title: "Catalogue",
    links: [
      { href: "/admin/produits", label: "Produits", icon: Package },
      { href: "/admin/stocks", label: "Stocks & mouvements", icon: Package },
      { href: "/admin/categories", label: "Catégories", icon: Tags },
      { href: "/admin/accueil", label: "Page d'accueil", icon: GalleryHorizontal },
    ],
  },
  {
    title: "Ventes",
    links: [
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/reservations", label: "Réservations", icon: CalendarClock },
      { href: "/admin/retours", label: "Retours & remboursements", icon: Undo2 },
      { href: "/admin/coupons", label: "Codes promo", icon: Tags },
      { href: "/admin/clients", label: "Clients (CRM)", icon: Contact },
    ],
  },
  {
    title: "Réseau",
    links: [
      { href: "/admin/consultants", label: "Consultants", icon: Users },
      { href: "/admin/primes-equipe", label: "Primes d'équipe", icon: Banknote },
      { href: "/admin/candidatures", label: "Candidatures", icon: Contact },
      { href: "/admin/messages", label: "Messages de contact", icon: Mail },
      { href: "/admin/annonces", label: "Annonces aux consultants", icon: Megaphone },
      { href: "/admin/whatsapp", label: "Centre WhatsApp", icon: Share2 },
      { href: "/admin/journal-whatsapp", label: "Journal WhatsApp", icon: Mail },
      { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
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
  { href: "/admin/mes-ventes", label: "Mes ventes", icon: BarChart3 },
  { href: "/admin/mes-commandes", label: "Mes commandes", icon: ShoppingCart },
  { href: "/admin/mes-clients", label: "Mes clients", icon: Contact },
  { href: "/admin/mes-filleuls", label: "Mon équipe", icon: UsersRound },
  { href: "/admin/mes-gains", label: "Mes gains", icon: Banknote },
  { href: "/admin/mon-marketing", label: "Mon marketing", icon: Share2 },
  { href: "/admin/ma-communication", label: "Ma communication", icon: Megaphone },
  { href: "/admin/mon-profil", label: "Mon profil", icon: UserCircle },
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

  // Mode « voir l'espace d'un consultant » (administrateur uniquement)
  const viewAsId = role === "ADMIN" ? (await cookies()).get("jamaal_viewas")?.value : undefined;
  const viewingAs = viewAsId ? await prisma.consultant.findUnique({ where: { id: viewAsId }, select: { name: true } }) : null;

  const unreadCount = session.user?.id
    ? await prisma.notification.count({ where: { userId: session.user.id, read: false } })
    : 0;

  const sidebarContent = (
    <>
      <Link href="/admin" className="px-2">
        <p className="font-serif-display text-lg font-semibold tracking-wide text-white">JAMAAL</p>
        <p className="text-xs text-white/65">Back-office</p>
      </Link>

      <div className="mt-4 px-1">
        <GlobalSearch />
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
        {role === "ADMIN" && !viewingAs &&
          adminGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-white/60">
                {group.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.links.map((l) => (
                  <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={16} />} />
                ))}
              </div>
            </div>
          ))}

        {role === "ADMIN" && !viewingAs && (
          <div>
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-white/60">
              Système
            </p>
            <div className="flex flex-col gap-0.5">
              <SidebarNavLink href="/admin/notifications" label="Notifications" icon={<Bell size={16} />} badge={unreadCount} />
              <SidebarNavLink href="/admin/utilisateurs" label="Utilisateurs" icon={<UserCog size={16} />} />
              <SidebarNavLink href="/admin/versements" label="Versements" icon={<Wallet size={16} />} />
              <SidebarNavLink href="/admin/modele-economique" label="Modèle économique" icon={<Calculator size={16} />} />
              <SidebarNavLink href="/admin/reglages" label="Réglages & Fidélité" icon={<Settings size={16} />} />
              <SidebarNavLink href="/admin/historique" label="Journal des actions" icon={<ClipboardList size={16} />} />
            </div>
          </div>
        )}

        {(role === "CONSULTANT" || !!viewingAs) && (
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

      {role !== "ADMIN" && (
        <div className="mt-3">
          <InstallApp />
        </div>
      )}

      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="px-2 text-xs font-medium text-white/80">{session.user?.name}</p>
        <p className="px-2 text-xs text-white/65">{session.user?.email}</p>
        <p className="px-2 text-xs uppercase tracking-wide text-rose">{role}</p>
        <form action={logoutAction}>
          <button className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-light transition hover:bg-white/5">
            Se déconnecter
          </button>
        </form>
        <Link
          href="/"
          className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white/70"
        >
          ← Retour au site
        </Link>
      </div>
    </>
  );

  return (
    <ResponsiveSidebar sidebar={sidebarContent}>
      {viewingAs && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose bg-rose/10 px-4 py-3 text-sm text-navy">
          <span>Vous consultez l&apos;espace de <strong>{viewingAs.name}</strong> (mode administrateur).</span>
          <form action={stopViewAsReseller}>
            <button className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-light">Quitter ce mode</button>
          </form>
        </div>
      )}
      {children}
    </ResponsiveSidebar>
  );
}
