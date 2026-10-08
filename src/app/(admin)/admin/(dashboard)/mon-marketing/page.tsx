import Link from "next/link";
import { BookOpen, FileImage, MessageSquareText, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getReseller, resellerLinks } from "@/lib/reseller";
import { CopyButton } from "@/components/admin/CopyButton";
import { QrCard } from "@/components/admin/QrCard";
import { ProductLinkGenerator } from "@/components/admin/ProductLinkGenerator";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

const tools = [
  { href: "/admin/mon-kit-marketing", title: "Kit marketing", text: "Photos et textes prêts à publier pour chaque produit.", icon: FileImage },
  { href: "/admin/outils", title: "Outils de vente", text: "Scripts WhatsApp à copier et mini-catalogue à imprimer.", icon: Wrench },
  { href: "/admin/formation", title: "Formation", text: "Guides pour bien démarrer et progresser.", icon: BookOpen },
];

export default async function MonMarketingPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const links = await resellerLinks(me.slug);

  const [products, promos] = await Promise.all([
    prisma.product.findMany({ select: { slug: true, name: true, regularPrice: true }, orderBy: { name: "asc" } }),
    prisma.promoCode.findMany({ where: { consultantId: me.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const shareMsg = `Bonjour ! Découvre toute la gamme Chogan (parfums, soins, maison, nutrition) au Sénégal, avec mes conseils : ${links.shop ?? ""}`;

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon marketing</h1>
      <p className="mt-1 text-sm text-navy/75">Tout pour faire connaître vos produits. Chaque lien ci-dessous attribue automatiquement les commandes à votre compte.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Ma boutique personnelle</h2>
          {links.shop ? (
            <>
              <p className="mt-1 text-sm text-navy/75">Votre vitrine : les clients voient votre nom et peuvent vous contacter.</p>
              <input readOnly value={links.shop} className="mt-3 w-full rounded-xl border border-line bg-cream px-3 py-2 text-xs" />
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={links.shop} label="Copier mon lien" />
                <CopyButton text={shareMsg} label="Copier un message prêt à envoyer" />
                <a href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                  Partager sur WhatsApp
                </a>
                <a href={links.shop} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream">
                  Voir ma page ↗
                </a>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-navy/75">Votre lien n&apos;est pas encore configuré : demandez à l&apos;équipe JAMAAL de renseigner votre identifiant.</p>
          )}
        </div>
        {links.shop && <QrCard url={links.shop} name={me.slug ?? me.name} />}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Lien d&apos;un produit précis</h2>
        <p className="mt-1 mb-4 text-sm text-navy/75">Cherchez un produit, copiez son lien avec votre code, et envoyez-le à votre client.</p>
        <ProductLinkGenerator
          products={products.map((p) => ({ slug: p.slug, name: p.name, price: p.regularPrice }))}
          origin={links.origin}
          refSlug={me.slug}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><MessageSquareText size={18} /> Mes codes promo</h2>
        <p className="mt-1 text-sm text-navy/75">Codes de réduction créés pour vous par l&apos;équipe JAMAAL. Donnez-les à vos clients pour déclencher un achat.</p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {promos.map((p) => {
            const expired = p.expiresAt && p.expiresAt < new Date();
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-mono text-sm font-semibold text-navy">{p.code}</p>
                  <p className="text-xs text-navy/70">
                    -{p.discountPct} % · utilisé {p.usedCount}{p.usageLimit ? ` / ${p.usageLimit}` : ""} fois
                    {p.expiresAt ? ` · ${expired ? "expiré le" : "valable jusqu'au"} ${p.expiresAt.toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </div>
                <CopyButton text={p.code} label="Copier le code" />
              </li>
            );
          })}
          {promos.length === 0 && <li className="py-4 text-center text-navy/70">Pas encore de code promo. Demandez-en un à l&apos;équipe JAMAAL sur WhatsApp (voir « Ma communication »).</li>}
        </ul>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <t.icon size={20} className="text-rose-dark" />
            <p className="mt-3 font-semibold text-navy">{t.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-navy/75">{t.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
