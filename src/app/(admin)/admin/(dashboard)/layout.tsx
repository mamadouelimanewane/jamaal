import Link from "next/link";
import { cookies } from "next/headers";
import { stopViewAsReseller } from "@/lib/actions/view-as";
import { redirect } from "next/navigation";
import { BadgePercent, BookOpen, Calculator,
  ShieldCheck,
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
  Share2,
  UsersRound,
  GalleryHorizontal,
  CalendarClock,
  Repeat,
  ListChecks,
  Store,
  Award,
  TrendingUp,
  HeartPulse,
  ShieldAlert,
  FileSignature,
  Sparkles,
  Gift,
  Trophy,
  Star,
  Zap,
  ShoppingBasket,
  GraduationCap,
  LogOut,
  FileText,
  BookMarked,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResponsiveSidebar } from "@/components/admin/ResponsiveSidebar";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-pref";
import { TopBar } from "@/components/admin/TopBar";
import { InstallBanner } from "@/components/admin/InstallBanner";
import { topBarRank } from "@/lib/topbar-rank";
import { SidebarNavLink } from "@/components/admin/SidebarNavLink";

import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { FormErrorBanner } from "@/components/admin/FormErrorBanner";
import { AutoTableLabels } from "@/components/admin/AutoTableLabels";
import { viewerWallet } from "@/lib/wallet-owner";
import { walletBalance } from "@/lib/wallet";
import { Suspense } from "react";
import { AssistantLauncher } from "@/components/admin/AdminAssistant";
import { geminiConfigured } from "@/lib/ai/gemini";
import { getAccess } from "@/lib/access";
import { allows, moduleForPath } from "@/lib/permissions";

const adminGroups = [
  {
    title: "Aperçu",
    links: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/assistant", label: "Assistant IA", icon: Sparkles },
    ],
  },
  {
    title: "Catalogue",
    links: [
      { href: "/admin/produits", label: "Produits", icon: Package },
      { href: "/admin/stocks", label: "Stocks & mouvements", icon: Package },
      { href: "/admin/stocks/commande-chogan", label: "Commande Chogan", icon: ShoppingBasket },
      { href: "/admin/stocks/prevision", label: "Prévision de stock", icon: TrendingUp },
      { href: "/admin/categories", label: "Catégories", icon: Tags },
      { href: "/admin/accueil", label: "Page d'accueil", icon: GalleryHorizontal },
      { href: "/admin/catalogue-officiel", label: "Catalogue officiel (12 pages A4)", icon: FileText },
      { href: "/admin/handbook", label: "Produits disponibles", icon: BookMarked },
    ],
  },
  {
    title: "Ventes",
    links: [
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/reservations", label: "Réservations", icon: CalendarClock },
      { href: "/admin/abonnements", label: "Abonnements et cartes cadeaux", icon: Repeat },
      { href: "/admin/reservations/a-commander", label: "À commander (réservations)", icon: ClipboardList },
      { href: "/admin/retours", label: "Retours & remboursements", icon: Undo2 },
      { href: "/admin/coupons", label: "Codes promo", icon: Tags },
      { href: "/admin/offres", label: "Offres de fêtes", icon: Gift },
      { href: "/admin/avis", label: "Avis clients", icon: Star },
      { href: "/admin/clients", label: "Clients (CRM)", icon: Contact },
    ],
  },
  {
    title: "Réseau",
    links: [
      { href: "/admin/consultants", label: "Consultants", icon: Users },
      { href: "/admin/conditions-speciales", label: "Conditions spéciales", icon: BadgePercent },
      { href: "/admin/primes-equipe", label: "Primes d'équipe", icon: Banknote },
      { href: "/admin/reseau", label: "Santé du réseau", icon: HeartPulse },
      { href: "/admin/fraude", label: "Contrôle des commissions", icon: ShieldAlert },
      { href: "/admin/defis", label: "Défis du mois", icon: Trophy },
      { href: "/admin/academie", label: "Académie", icon: Award },
      { href: "/admin/candidatures", label: "Candidatures", icon: Contact },
      { href: "/admin/protocole", label: "Protocole de partenariat", icon: FileSignature },
      { href: "/admin/messages", label: "Messages de contact", icon: Mail },
      { href: "/admin/annonces", label: "Annonces aux consultants", icon: Megaphone },
      { href: "/admin/whatsapp", label: "Centre WhatsApp", icon: Share2 },
      { href: "/admin/whatsapp/conversations", label: "Conversations WhatsApp", icon: Mail },
      { href: "/admin/whatsapp/campagnes", label: "Campagnes WhatsApp", icon: Megaphone },
      { href: "/admin/journal-whatsapp", label: "Journal WhatsApp", icon: Mail },
      { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
      { href: "/admin/livreurs", label: "Livreurs", icon: Bike },
    ],
  },
  {
    title: "Pilotage",
    links: [
      { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
      { href: "/admin/automatisations", label: "Automatisations", icon: Zap },
      { href: "/admin/comptabilite", label: "Comptabilité & finance", icon: Wallet },
    ],
  },
  {
    title: "Contenu",
    links: [
      { href: "/admin/blog", label: "Blog", icon: Newspaper },
      { href: "/admin/skin-advisor", label: "Skin Advisor", icon: Sparkles },
    ],
  },
];

/** Espace revendeur : rangé par sujet. Profil, contrat, classement et notifications sont dans la barre du haut ;
 * le wallet (retraits, dépôts) est dans « Mes gains » ; l'assistant IA a son bouton en bas de chaque page. */
const consultantGroups: { title: string | null; links: { href: string; label: string; icon: typeof LayoutDashboard; match?: string[] }[] }[] = [
  { title: null, links: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard }, { href: "/admin/copilote", label: "Mes actions du jour", icon: ListChecks }] },
  {
    title: "Ventes",
    links: [
      { href: "/admin/mes-commandes", label: "Mes commandes", icon: ShoppingCart },
      { href: "/admin/mes-ventes", label: "Mes ventes", icon: BarChart3 },
      { href: "/admin/mes-clients", label: "Mes clients", icon: Contact },
    ],
  },
  {
    title: "Gains & équipe",
    links: [
      { href: "/admin/mes-gains", label: "Mes gains", icon: Banknote, match: ["/admin/mon-wallet"] },
      { href: "/admin/mes-filleuls", label: "Mon équipe", icon: UsersRound },
      { href: "/admin/mes-defis", label: "Mes défis", icon: Trophy },
    ],
  },
  {
    title: "Promotion",
    links: [
      { href: "/admin/catalogue", label: "Produits", icon: Package },
      { href: "/admin/mon-marketing", label: "Mon marketing", icon: Share2, match: ["/admin/mon-kit-marketing", "/admin/outils"] },
      { href: "/admin/ma-boutique", label: "Ma boutique (lien de bio)", icon: Store },
      { href: "/admin/stats-boutique", label: "Statistiques de ma boutique", icon: BarChart3 },
      { href: "/admin/ma-communication", label: "Ma communication", icon: Megaphone },
      { href: "/admin/catalogue-officiel", label: "Catalogue officiel (12 pages)", icon: FileText },
      { href: "/admin/handbook", label: "Produits disponibles", icon: BookMarked },
    ],
  },
  { title: "Progresser", links: [{ href: "/admin/academie", label: "Académie et badges", icon: Award }, { href: "/admin/formation", label: "Quiz et formation", icon: GraduationCap }] },
];

const livreurLinks = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/mes-livraisons", label: "Mes livraisons", icon: Truck },
  { href: "/admin/mon-wallet", label: "Mon wallet", icon: Wallet },
];

/** Titre de section du menu (masqué quand le menu est replié). */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="side-full mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-white/60">{children}</p>;
}

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/login" });
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/admin/login");
  const role = session.user?.role;
  // Les comptes clients n'ont rien à faire dans le back-office : leur espace est /compte.
  if (role === "CLIENT") redirect("/compte");

  // Compte relu en base : suspendu ou rôle modifié depuis la connexion = déconnexion immédiate.
  const access = session.user?.id ? await getAccess(session.user.id) : null;
  if (!access || !access.active || access.role !== role) redirect(`/admin/deconnexion?motif=${access && !access.active ? "suspendu" : "session"}`);
  // Administrateur restreint : le menu ne montre que les modules de son profil.
  const perms = access.perms;
  const canSee = (href: string) => href === "/admin" || allows(perms, moduleForPath(href), "read");
  const visibleGroups = adminGroups.map((g) => ({ ...g, links: g.links.filter((l) => canSee(l.href)) })).filter((g) => g.links.length > 0);

  // Mode « voir l'espace d'un consultant » (administrateur uniquement)
  const viewAsId = role === "ADMIN" ? (await cookies()).get("jamaal_viewas")?.value : undefined;
  const viewingAs = viewAsId ? await prisma.consultant.findUnique({ where: { id: viewAsId }, select: { name: true } }) : null;

  // Wallet du revendeur ou du livreur : solde affiché en permanence dans la barre du haut.
  const myWallet = role === "ADMIN" && !viewingAs ? null : await viewerWallet();
  const walletBal = myWallet ? (await walletBalance(myWallet.owner)).balance : null;
  const walletHref = myWallet?.owner.type === "LIVREUR" ? "/admin/mon-wallet" : "/admin/mes-gains#wallet";
  const rank = myWallet?.owner.type === "CONSULTANT" ? await topBarRank(myWallet.owner.id).catch(() => null) : null;

  const unreadCount = session.user?.id
    ? await prisma.notification.count({ where: { userId: session.user.id, read: false } })
    : 0;
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "replie";
  const isReseller = role === "CONSULTANT" || !!viewingAs;
  const roleLabel = viewingAs ? `Vue de ${viewingAs.name}` : role === "ADMIN" ? "Administrateur" : role === "LIVREUR" ? "Livreur" : rank?.title ?? "Consultant";

  const sidebarContent = (
    <>
      <Link href="/admin" className="flex items-center gap-2 px-2" title="Tableau de bord">
        <span className="side-mini h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 font-serif-display text-lg font-semibold text-white">J</span>
        <span className="side-full">
          <span className="block font-serif-display text-lg font-semibold tracking-wide text-white">JAMAAL</span>
          <span className="block text-xs text-white/65">{isReseller ? "Espace consultant" : role === "LIVREUR" ? "Espace livreur" : "Back-office"}</span>
        </span>
      </Link>

      <div className="side-full mt-4 px-1 md:hidden">
        <GlobalSearch />
      </div>

      <nav aria-label="Menu principal" className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden">
        {role === "ADMIN" && !viewingAs &&
          visibleGroups.map((group) => (
            <div key={group.title}>
              <SectionTitle>{group.title}</SectionTitle>
              <div className="flex flex-col gap-0.5">
                {group.links.map((l) => (
                  <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={18} />} />
                ))}
              </div>
            </div>
          ))}

        {role === "ADMIN" && !viewingAs && (
          <div>
            <SectionTitle>Système</SectionTitle>
            <div className="flex flex-col gap-0.5">
              <SidebarNavLink href="/admin/notifications" label="Notifications" icon={<Bell size={18} />} badge={unreadCount} />
              {canSee("/admin/utilisateurs") && <SidebarNavLink href="/admin/utilisateurs" label="Utilisateurs" icon={<UserCog size={18} />} />}
              {canSee("/admin/wallets") && <SidebarNavLink href="/admin/wallets" label="Wallets des membres" icon={<Wallet size={18} />} />}
              {canSee("/admin/versements") && <SidebarNavLink href="/admin/versements" label="Versements" icon={<Wallet size={18} />} />}
              {canSee("/admin/modele-economique") && <SidebarNavLink href="/admin/modele-economique" label="Modèle économique" icon={<Calculator size={18} />} />}
              {canSee("/admin/reglages") && <SidebarNavLink href="/admin/reglages" label="Réglages & Fidélité" icon={<Settings size={18} />} />}
              {canSee("/admin/historique") && <SidebarNavLink href="/admin/historique" label="Journal des actions" icon={<ClipboardList size={18} />} />}
              {canSee("/admin/protection") && <SidebarNavLink href="/admin/protection" label="Protection anti-aspiration" icon={<ShieldCheck size={18} />} />}
            </div>
          </div>
        )}

        {isReseller &&
          consultantGroups.map((group) => (
            <div key={group.title ?? "accueil"}>
              {group.title && <SectionTitle>{group.title}</SectionTitle>}
              <div className="flex flex-col gap-0.5">
                {group.links.map((l) => (
                  <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={18} />} match={l.match} />
                ))}
              </div>
            </div>
          ))}

        {role === "LIVREUR" && (
          <div className="flex flex-col gap-0.5">
            {livreurLinks.map((l) => (
              <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={18} />} />
            ))}
          </div>
        )}
      </nav>

      <form action={logoutAction} className="mt-3 border-t border-white/10 pt-3">
        <button title="Se déconnecter" className="side-link flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-light transition hover:bg-white/5">
          <LogOut size={18} className="shrink-0" /> <span className="side-label">Se déconnecter</span>
        </button>
      </form>
    </>
  );

  const topbar = (
    <TopBar
      role={role === "ADMIN" ? (viewingAs ? "CONSULTANT" : "ADMIN") : role === "LIVREUR" ? "LIVREUR" : "CONSULTANT"}
      user={{ name: viewingAs?.name ?? session.user?.name ?? "", detail: roleLabel }}
      balance={walletBal}
      walletHref={walletHref}
      rank={rank}
      unread={unreadCount}
      logout={logoutAction}
    />
  );

  return (
    <ResponsiveSidebar sidebar={sidebarContent} topbar={topbar} initialCollapsed={collapsed}>
      {viewingAs && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose bg-rose/10 px-4 py-3 text-sm text-navy">
          <span>Vous consultez l&apos;espace de <strong>{viewingAs.name}</strong> (mode administrateur).</span>
          <form action={stopViewAsReseller}>
            <button className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-light">Quitter ce mode</button>
          </form>
        </div>
      )}
      <Suspense fallback={null}><FormErrorBanner /></Suspense>
      <AutoTableLabels />
      {(role === "CONSULTANT" || role === "LIVREUR") && <InstallBanner />}
      {children}
      {geminiConfigured() && role && <AssistantLauncher role={role} />}
    </ResponsiveSidebar>
  );
}
