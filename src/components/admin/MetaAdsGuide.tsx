import { Megaphone, ShoppingBag } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";
import { resellerCatalogUrl } from "@/lib/meta-catalog";

/**
 * Publicité Facebook / Instagram du revendeur (Mon marketing) : booster sa boutique (le plus simple)
 * ou, pour les revendeurs avancés, son catalogue Meta personnel dont chaque lien porte son code.
 */
export function MetaAdsGuide({ origin, slug, shop, shopName }: { origin: string; slug: string; shop: string; shopName: string }) {
  const adLink = `${shop}?utm_source=facebook&utm_medium=paid&utm_campaign=boost-boutique`;
  const adText = `✨ Parfums et soins de luxe Chogan, conseillés par ${shopName}.\n🚚 Livraison à domicile · Paiement Wave, Orange Money ou à la livraison.\n👉 Découvrez ma boutique et commandez sur WhatsApp : ${adLink}`;
  const catalog = resellerCatalogUrl(origin, slug);
  const step = "flex gap-3";
  const num = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white";

  return (
    <div id="publicite" className="mt-6 scroll-mt-24 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-serif-display text-lg font-semibold text-navy">Publicité Facebook et Instagram</h2>
      <p className="mt-1 text-sm text-navy/75">
        Deux façons de faire de la publicité payante. Dans les deux cas, les liens portent votre code : les ventes vous reviennent.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-cream/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Pour débuter · le plus simple</p>
          <h3 className="mt-1 flex items-center gap-2 font-semibold text-navy"><Megaphone size={18} /> Booster ma boutique</h3>
          <ol className="mt-3 space-y-3 text-sm text-navy/85">
            <li className={step}><span className={num}>1</span><span>Publiez une belle photo ou une courte vidéo d&apos;un parfum sur votre <strong>page Facebook</strong> ou votre <strong>compte Instagram professionnel</strong>, avec le texte ci-dessous.</span></li>
            <li className={step}><span className={num}>2</span><span>Sous la publication, cliquez sur <strong>Booster la publication</strong>.</span></li>
            <li className={step}><span className={num}>3</span><span>Objectif : <strong>plus de visites sur le site</strong>. Bouton : <strong>En savoir plus</strong>. Adresse : votre lien publicité ci-dessous.</span></li>
            <li className={step}><span className={num}>4</span><span>Audience : votre ville et les alentours, adultes intéressés par les parfums, la beauté ou la mode.</span></li>
            <li className={step}><span className={num}>5</span><span>Budget : commencez petit, sur quelques jours, puis remettez de l&apos;argent sur ce qui fait venir des clients (voir <strong>Statistiques de ma boutique</strong>, visites « facebook » ou « instagram »).</span></li>
          </ol>
          <p className="mt-4 text-xs font-semibold text-navy/70">Mon lien publicité</p>
          <input readOnly value={adLink} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs" />
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={adLink} label="Copier le lien publicité" />
            <CopyButton text={adText} label="Copier le texte de la publication" />
          </div>
        </section>

        <section className="rounded-2xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-dark">Revendeurs avancés</p>
          <h3 className="mt-1 flex items-center gap-2 font-semibold text-navy"><ShoppingBag size={18} /> Mon catalogue Meta</h3>
          <p className="mt-2 text-sm text-navy/80">
            Tous les produits JAMAAL (photos, prix, disponibilité), mis à jour chaque jour, avec <strong>votre code sur chaque lien</strong>.
            Il faut un compte <strong>Meta Business</strong> (business.facebook.com) à votre nom.
          </p>
          <ol className="mt-3 space-y-3 text-sm text-navy/85">
            <li className={step}><span className={num}>1</span><span>Ouvrez <strong>business.facebook.com/commerce</strong>, puis <strong>Ajouter un catalogue</strong> › <strong>Produits en ligne</strong>. Ne choisissez aucune plateforme partenaire (ni Shopify, ni WooCommerce).</span></li>
            <li className={step}><span className={num}>2</span><span>Choisissez <strong>Importer un fichier de données</strong> › <strong>Utiliser une URL ou Google Sheets</strong>, et collez votre adresse catalogue. Laissez vides le nom de profil et le mot de passe.</span></li>
            <li className={step}><span className={num}>3</span><span>Devise : <strong>XOF</strong>. Mise à jour : <strong>chaque jour</strong>, la nuit. Fuseau : <strong>GMT+00:00</strong>. Puis <strong>Importer</strong>.</span></li>
            <li className={step}><span className={num}>4</span><span>Créez une publicité <strong>catalogue Advantage+</strong> dans le Gestionnaire de publicités, avec ce catalogue.</span></li>
          </ol>
          <p className="mt-4 text-xs font-semibold text-navy/70">Mon adresse catalogue</p>
          <input readOnly value={catalog} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2 text-xs" />
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={catalog} label="Copier mon adresse catalogue" />
          </div>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            Bon à savoir : les visites et achats du site sont mesurés par JAMAAL, pas par votre compte Meta. Vos publicités catalogue ciblent donc
            moins finement que celles de JAMAAL : commencez par « Booster ma boutique » si vous débutez.
          </p>
        </section>
      </div>
    </div>
  );
}
