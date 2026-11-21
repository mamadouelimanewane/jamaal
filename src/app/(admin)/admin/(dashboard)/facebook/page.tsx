import { CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { CopyButton } from "@/components/admin/CopyButton";
import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

export const dynamic = "force-dynamic";

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

/**
 * Facebook et Instagram (Meta) : le site comme source de données du Gestionnaire de commerce
 * (flux catalogue) et du Gestionnaire d'événements (pixel), pour des campagnes qui montrent tous les produits.
 */
export default async function FacebookPage() {
  await requireAdmin("whatsapp", "read");
  const site = await getSiteUrl();
  const feedUrl = `${site}/api/meta/catalog`;
  const pixelId = META_PIXEL_ID;
  const capiOk = !!process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const pixelOk = /^\d{5,30}$/.test(pixelId);

  const products = await prisma.product.findMany({
    where: { isOfficial: true },
    select: { regularPrice: true, publicPrice: true, photo: true, stock: true, variants: { select: { stock: true } } },
  });
  const inFeed = products.filter((p) => (p.regularPrice ?? p.publicPrice ?? 0) > 0);
  const noPrice = products.length - inFeed.length;
  const noPhoto = inFeed.filter((p) => !p.photo).length;
  const inStock = inFeed.filter((p) => (p.variants.length ? p.variants.some((v) => v.stock > 0) : p.stock > 0)).length;

  return (
    <div className="max-w-4xl">
      <h1 className="flex items-center gap-3 font-serif-display text-2xl font-semibold text-navy">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1877F2] text-white"><FacebookIcon size={20} /></span>
        Facebook et Instagram
      </h1>
      <p className="mt-2 text-sm text-navy/75">
        Le site JAMAAL comme <strong>source de données</strong> chez Meta : le catalogue de tous les produits pour vos campagnes Facebook et Instagram, et le pixel qui mesure les visites, ajouts au panier et achats venus de ces campagnes.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">1. Catalogue des produits (flux)</h2>
        <p className="mt-1 text-sm text-navy/75">Adresse à coller dans Meta. Le flux se met à jour tout seul : prix, photo, stock et lien de chaque produit.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-cream/70 px-3 py-2">
          <code className="break-all text-sm text-navy">{feedUrl}</code>
          <CopyButton text={feedUrl} />
          <a href="/api/meta/catalog" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-navy underline">Voir le flux <ExternalLink size={12} /></a>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Produits dans le flux", inFeed.length], ["En stock", inStock], ["Sans photo (logo affiché)", noPhoto], ["Exclus : sans prix", noPrice]].map(([label, n]) => (
            <div key={label as string} className="rounded-xl bg-cream/70 p-3"><p className="text-xs text-navy/65">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-navy">{n}</p></div>
          ))}
        </div>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-navy/85">
          <li>Ouvrez le <a className="font-semibold underline" href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer">Gestionnaire de commerce</a> et choisissez (ou créez) le catalogue JAMAAL.</li>
          <li><strong>Catalogue › Sources de données › Ajouter des articles › Flux de données</strong>.</li>
          <li>Choisissez « Utiliser une URL », collez l&apos;adresse ci-dessus, mise à jour <strong>tous les jours</strong>, devise XOF.</li>
          <li>Meta importe tous les produits ; ils deviennent utilisables dans vos publicités et sur votre boutique Facebook / Instagram.</li>
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">2. Pixel Meta (mesure des campagnes)</h2>
        {pixelOk ? (
          <>
            <Status ok>Pixel actif sur tout le site et sur les boutiques des revendeurs (identifiant {pixelId}).</Status>
            <ul className="mt-3 space-y-1 text-sm text-navy/85">
              <li><strong>PageView</strong> : chaque page visitée.</li>
              <li><strong>ViewContent</strong> : fiche d&apos;un produit, avec son prix de départ.</li>
              <li><strong>AddToCart</strong> : tout ajout au panier (produit, quantité, montant).</li>
              <li><strong>InitiateCheckout</strong> : ouverture du panier pour commander (montant, nombre d&apos;articles).</li>
              <li><strong>Purchase</strong> : seulement quand la commande est payée, avec son montant en XOF. Les identifiants produit sont ceux du catalogue.</li>
            </ul>
            {capiOk ? (
              <Status ok>Achats envoyés aussi depuis le serveur (API Conversions) : chaque commande payée est comptée, y compris le paiement à la livraison et les clients qui ne reviennent pas sur la page de confirmation. Meta ne la compte qu&apos;une fois.</Status>
            ) : (
              <Status ok={false}>
                API Conversions non activée : les achats ne sont comptés que si le client revoit la page de confirmation après paiement (pas les paiements à la livraison). Pour l&apos;activer : Gestionnaire d&apos;événements › votre pixel › Paramètres › API Conversions › « Générer un jeton d&apos;accès », puis dans Vercel ajoutez <code className="rounded bg-cream px-1">META_CAPI_ACCESS_TOKEN</code> avec ce jeton et relancez un déploiement.
              </Status>
            )}
          </>
        ) : (
          <Status ok={false}>Pixel non installé : aucun identifiant n&apos;est renseigné. Sans lui, Meta ne peut ni mesurer les ventes de vos campagnes ni montrer à chaque personne les produits qu&apos;elle a regardés.</Status>
        )}
        {!pixelOk && (
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-navy/85">
            <li>Dans le <a className="font-semibold underline" href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer">Gestionnaire d&apos;événements</a> : <strong>Connecter des sources de données › Web › Pixel Meta</strong>, nommez-le « JAMAAL ».</li>
            <li>Copiez l&apos;identifiant du pixel (une suite de chiffres).</li>
            <li>Dans Vercel (projet jamaal › Settings › Environment Variables), ajoutez <code className="rounded bg-cream px-1">NEXT_PUBLIC_META_PIXEL_ID</code> avec cet identifiant, puis relancez un déploiement.</li>
            <li>Revenez sur cette page : l&apos;état passe au vert.</li>
          </ol>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">3. Relier les deux et lancer une campagne</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-navy/85">
          <li>Gestionnaire de commerce › <strong>Catalogue › Sources d&apos;événements</strong> : associez le pixel JAMAAL au catalogue.</li>
          <li>Gestionnaire de publicités › nouvelle campagne <strong>Ventes</strong> › cochez <strong>Catalogue Advantage+</strong> et choisissez le catalogue JAMAAL.</li>
          <li>Tous les produits du flux peuvent alors apparaître dans la campagne ; Meta montre à chacun ceux qui l&apos;intéressent.</li>
        </ol>
        <p className="mt-3 text-xs text-navy/65">Les visites venues de ces campagnes apparaissent aussi dans les statistiques des boutiques, ligne « Facebook » ou « Instagram ».</p>
      </section>
    </div>
  );
}
