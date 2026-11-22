import { CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { CopyButton } from "@/components/admin/CopyButton";
import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import { isUnsoldFormat, startingPrice } from "@/lib/price-from";
import { META_CATALOG_ID, PRICE_CHECK_ABOVE, resellerCatalogUrl } from "@/lib/meta-catalog";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

/** Début de la période des statistiques (calculé à chaque requête : page dynamique). */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

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

  const since = daysAgo(30);
  const [products, resellers, socialVisits, resellerOrders] = await Promise.all([
    prisma.product.findMany({
      where: { isOfficial: true },
      select: { id: true, name: true, regularPrice: true, publicPrice: true, volumes: true, photo: true, stock: true, variants: { select: { stock: true, volumeLabel: true } } },
    }),
    prisma.consultant.findMany({ where: { active: true, slug: { not: null } }, select: { id: true, name: true, shopName: true, city: true, slug: true } }),
    prisma.shopEvent.groupBy({ by: ["consultantId", "source"], where: { kind: "visite", source: { in: ["facebook", "instagram"] }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["consultantId"], where: { consultantId: { not: null }, createdAt: { gte: since }, status: { notIn: ["NON_PAYEE", "ANNULEE"] } }, _count: { _all: true } }),
  ]);
  // Mêmes règles que le flux /api/meta/catalog : prix « à partir de » (sans 15 ml), stock des formats vendus.
  const priced = products.map((p) => ({ ...p, from: startingPrice(p.regularPrice ?? p.publicPrice, p.volumes) ?? 0 }));
  const inFeed = priced.filter((p) => p.from > 0);
  const noPrice = products.length - inFeed.length;
  const noPhoto = inFeed.filter((p) => !p.photo).length;
  const inStock = inFeed.filter((p) => {
    const sold = p.variants.filter((v) => !isUnsoldFormat(v.volumeLabel));
    const vs = sold.length ? sold : p.variants;
    return vs.length ? vs.some((v) => v.stock > 0) : p.stock > 0;
  }).length;
  const toCheck = inFeed.filter((p) => p.from > PRICE_CHECK_ABOVE).sort((a, b) => b.from - a.from);
  const catalogUrl = `https://business.facebook.com/commerce/catalogs/${META_CATALOG_ID}/products/`;

  // Revendeurs : visites de leur boutique venues de Facebook / Instagram et commandes payées (30 jours).
  const visits = new Map<string, { facebook: number; instagram: number }>();
  for (const v of socialVisits) {
    const row = visits.get(v.consultantId) ?? { facebook: 0, instagram: 0 };
    row[v.source as "facebook" | "instagram"] += v._count._all;
    visits.set(v.consultantId, row);
  }
  const orders = new Map(resellerOrders.map((o) => [o.consultantId!, o._count._all]));
  const resellerRows = resellers
    .map((c) => ({ ...c, fb: visits.get(c.id)?.facebook ?? 0, ig: visits.get(c.id)?.instagram ?? 0, orders: orders.get(c.id) ?? 0 }))
    .sort((a, b) => b.fb + b.ig - (a.fb + a.ig) || b.orders - a.orders || a.name.localeCompare(b.name));
  const announce = `Bonjour ! Nouveau dans votre espace JAMAAL › Mon marketing : « Publicité Facebook et Instagram ».\n\n• Booster ma boutique : lien publicité et texte prêts à copier, en 5 étapes.\n• Mon catalogue Meta : tous les produits JAMAAL avec votre code, pour vos publicités catalogue.\n\nToutes les ventes venues de vos publicités vous sont attribuées. ${site}/admin/mon-marketing#publicite`;

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
        <Status ok>
          Catalogue créé dans Meta (Kwingo sa, identifiant {META_CATALOG_ID}), relié à l&apos;ensemble de données <strong>JAMAAL Web</strong>, mis à jour chaque nuit.{" "}
          <a href={catalogUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">Ouvrir le catalogue <ExternalLink size={12} /></a>
        </Status>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Produits dans le flux", inFeed.length], ["En stock", inStock], ["Sans photo (logo affiché)", noPhoto], ["Exclus : sans prix", noPrice]].map(([label, n]) => (
            <div key={label as string} className="rounded-xl bg-cream/70 p-3"><p className="text-xs text-navy/65">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-navy">{n}</p></div>
          ))}
        </div>
        {toCheck.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-sm font-semibold text-amber-900">Prix à vérifier ({toCheck.length}) : prix de départ au-dessus de {formatPrice(PRICE_CHECK_ABOVE)}</p>
            <p className="mt-0.5 text-xs text-amber-900/80">Ces prix partent tels quels dans les publicités. S&apos;ils sont justes, rien à faire ; sinon corrigez la fiche, le catalogue suivra la nuit suivante.</p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {toCheck.slice(0, 20).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <a href={`/admin/produits/${p.id}/modifier`} className="truncate text-navy underline">{p.name}</a>
                  <span className="shrink-0 tabular-nums text-amber-900">{formatPrice(p.from)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details className="mt-4 text-sm text-navy/85">
          <summary className="cursor-pointer font-semibold text-navy">Recréer le catalogue (mode d&apos;emploi)</summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li><a className="font-semibold underline" href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer">Gestionnaire de commerce</a> › <strong>Ajouter un catalogue</strong> › <strong>Produits en ligne</strong>, sans plateforme partenaire ; portefeuille Kwingo sa ; associez seulement <strong>JAMAAL Web</strong>.</li>
            <li><strong>Importer un fichier de données</strong> › <strong>Utiliser une URL ou Google Sheets</strong> › collez l&apos;adresse ci-dessus (nom de profil et mot de passe vides).</li>
            <li>Devise <strong>XOF</strong>, mise à jour <strong>chaque jour</strong> la nuit, fuseau GMT+00:00, puis <strong>Importer</strong>.</li>
          </ol>
        </details>
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

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">4. Publicité des revendeurs</h2>
        <p className="mt-1 text-sm text-navy/75">
          Chaque revendeur trouve dans <strong>Mon marketing › Publicité Facebook et Instagram</strong> son lien « Booster ma boutique » et son catalogue Meta personnel :
          les mêmes produits, avec son code sur chaque lien (ventes attribuées). Ci-dessous, sur 30 jours : visites de sa boutique venues de Facebook et d&apos;Instagram, et commandes payées.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={announce} label="Copier le message d'annonce aux revendeurs" />
          <a href="/admin/boutiques-stats" className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream">Statistiques des boutiques et annonces ciblées</a>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-navy/65">
                <th className="py-2 pr-3 font-medium">Revendeur</th>
                <th className="py-2 pr-3 text-right font-medium">Facebook</th>
                <th className="py-2 pr-3 text-right font-medium">Instagram</th>
                <th className="py-2 pr-3 text-right font-medium">Commandes payées</th>
                <th className="py-2 font-medium">Catalogue Meta du revendeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {resellerRows.slice(0, 60).map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-3">
                    <a href={`/admin/consultants/${c.id}`} className="font-medium text-navy underline">{c.shopName?.trim() || c.name}</a>
                    <span className="block text-xs text-navy/60">{c.city} · /c/{c.slug}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.fb}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.ig}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.orders}</td>
                  <td className="py-2"><CopyButton text={resellerCatalogUrl(site, c.slug!)} label="Copier" /></td>
                </tr>
              ))}
              {resellerRows.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-navy/65">Aucun revendeur actif avec une boutique.</td></tr>
              )}
            </tbody>
          </table>
          {resellerRows.length > 60 && <p className="mt-2 text-xs text-navy/60">60 premiers sur {resellerRows.length}, classés par visites venues de Facebook et Instagram.</p>}
        </div>
      </section>
    </div>
  );
}
