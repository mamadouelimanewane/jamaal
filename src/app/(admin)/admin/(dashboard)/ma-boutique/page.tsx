import Link from "next/link";
import { getReseller, resellerLinks } from "@/lib/reseller";
import { resellerCatalog } from "@/lib/reseller-catalog";
import { NotReseller } from "@/components/admin/NotReseller";
import { MyShopForm } from "@/components/admin/MyShopForm";
import { CopyButton } from "@/components/admin/CopyButton";
import { earnedBadges } from "@/lib/academy-store";
import { badgeLabel } from "@/data/academy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ma boutique" };

/** Personnalisation de la boutique personnelle (/c/<slug>), le lien de bio Instagram et TikTok. */
export default async function MaBoutiquePage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const [links, catalog, badges] = await Promise.all([resellerLinks(me.slug ?? null), resellerCatalog(), earnedBadges(me.id)]);
  const products = catalog.map((p) => ({ id: p.id, name: p.name, code: p.choganCode, price: p.price, multiFormat: p.multiFormat, inspiredBy: p.inspiredBy }));
  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Ma boutique</h1>
      <p className="mt-1 text-sm text-navy/75">Votre mini-boutique mobile : photo, thème personnalisé, présentation, coups de cœur, avis de vos clients et bouton WhatsApp. C&apos;est le lien à mettre dans votre bio Instagram et TikTok.</p>
      {links.shop ? (
        <div className="mt-5 rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">Mon lien de bio</p>
          <p className="mt-1 break-all font-mono text-sm text-navy">{links.shop}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={links.shop} label="Copier le lien" />
            <a href={links.shop} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream">Voir ma boutique ↗</a>
            <Link href="/admin/stats-boutique" className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream">Mes statistiques</Link>
          </div>
          <p className="mt-3 text-xs text-navy/60">Instagram : Modifier le profil › Liens › Ajouter un lien. TikTok : Modifier le profil › Site web.</p>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Votre identifiant de lien n&apos;est pas encore configuré : demandez-le à l&apos;équipe JAMAAL.</p>
      )}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <MyShopForm
          photo={me.shopPhoto ?? null}
          logo={me.shopLogo ?? null}
          bio={me.shopBio ?? null}
          tagline={me.shopTagline ?? null}
          theme={me.shopTheme ?? null}
          look={{ accent: me.shopAccent, hero: me.shopHero, typo: me.shopTypo, hidden: me.shopHidden }}
          favorites={me.favorites ?? []}
          products={products}
          name={me.name}
          titleForm={me.titleForm ?? null}
          badges={badges.map((b) => `${b.badge.emoji} ${badgeLabel(b.badge, me.titleForm)}`)}
        />
      </div>
    </div>
  );
}
