import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Gift, MapPin, MessageCircle, Search, ShieldCheck, Sparkles, Star, Truck, Dna } from "lucide-react";
import { getConsultantShop, shopWhatsAppLink } from "@/lib/shop/consultant-shop";
import { priceLabel } from "@/lib/share-text";
import { getSiteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getConsultantShop(slug).catch(() => null);
  if (!shop) return { title: "Boutique JAMAAL" };
  const first = shop.consultant.name.split(/\s+/)[0];
  const description = shop.consultant.bio || `Parfums et soins Chogan avec ${first}, votre conseiller·e JAMAAL à ${shop.consultant.city}. Commande sur WhatsApp, livraison à domicile.`;
  return {
    title: `La boutique de ${first}`,
    description,
    openGraph: { title: `La boutique de ${first} · JAMAAL`, description, images: shop.consultant.photo ? [shop.consultant.photo] : shop.products[0]?.photo ? [shop.products[0].photo] : undefined },
  };
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/**
 * Boutique personnelle du consultant, pensée pour la bio Instagram et TikTok (« Linktree JAMAAL ») : photo,
 * présentation, bouton WhatsApp, coups de cœur, avis clients et raccourcis. Toutes les commandes passées
 * depuis cette page lui sont attribuées (cookie posé par src/proxy.ts sur /c/<slug>, et ?ref= sur chaque lien).
 */
export default async function ConsultantShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await getConsultantShop(slug);
  if (!shop) notFound();
  const { consultant: c, products, reviews, stats } = shop;
  const first = c.name.split(/\s+/)[0];
  const ref = `?ref=${c.slug}`;
  const origin = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
  const wa = shopWhatsAppLink(c.whatsapp, `Bonjour ${first}, je viens de votre boutique JAMAAL ${origin}/c/${c.slug} : j'aimerais un conseil 🌸`);
  const waProduct = (name: string) => shopWhatsAppLink(c.whatsapp, `Bonjour ${first}, je suis intéressé·e par ${name} (vu sur votre boutique JAMAAL). Il est disponible ?`);

  const shortcuts = [
    { href: `/parfum-adn${ref}`, label: "Trouver mon parfum en 1 minute", icon: Dna },
    { href: `/collections${ref}`, label: "Toute la boutique", icon: Search },
    { href: `/skin-advisor${ref}`, label: "Ma routine de soins en un selfie", icon: Sparkles },
    { href: `/carte-cadeau${ref}`, label: "Offrir une carte cadeau", icon: Gift },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f6e9e3] via-[#fdfbfa] to-[#fdfbfa]">
      <div className="mx-auto max-w-md px-4 pb-16 pt-8">
        {/* En-tête : photo, nom, présentation */}
        <section className="text-center">
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-navy shadow-xl">
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- photo du consultant (stockage du site)
              <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-serif-display text-4xl text-white">{initials(c.name)}</span>
            )}
          </div>
          <h1 className="mt-4 font-serif-display text-3xl font-semibold text-navy">{c.name}</h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-navy/70">
            <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">{c.title} JAMAAL</span>
            <MapPin size={14} /> {c.city}
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-navy/80">
            {c.bio || `Bienvenue dans ma boutique ! Je vous conseille parfums et soins Chogan et je m'occupe de votre commande jusqu'à la livraison. 🌸`}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-navy/65">
            {stats.clients >= 3 && <span>⭐ {stats.clients} clients servis</span>}
            {stats.rating && <span>{stats.rating.toFixed(1).replace(".", ",")} / 5 sur mes avis</span>}
            <span className="inline-flex items-center gap-1"><Truck size={13} /> Livraison à domicile</span>
          </div>
        </section>

        {/* Bouton principal */}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-[#25D366]/30 transition hover:opacity-90">
            <MessageCircle size={20} /> Me contacter sur WhatsApp
          </a>
        )}

        {/* Raccourcis (« liens de bio ») */}
        <nav aria-label="Raccourcis" className="mt-3 grid gap-2.5">
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-sm font-semibold text-navy shadow-sm transition hover:border-navy/40">
              <s.icon size={18} className="shrink-0 text-rose-dark" /> {s.label}
            </Link>
          ))}
        </nav>

        {/* Coups de cœur */}
        {products.length > 0 && (
          <section className="mt-9">
            <h2 className="font-serif-display text-xl font-semibold text-navy">{shop.chosen ? `Les coups de cœur de ${first}` : "Les préférés de mes clients"}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {products.map((p) => {
                const ask = waProduct(p.name);
                return (
                  <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                    <Link href={`/produits/${p.slug}${ref}`} className="block aspect-square bg-cream">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- photos du catalogue
                        <img src={p.photo} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-navy/25"><Sparkles size={32} /></span>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col p-3">
                      <Link href={`/produits/${p.slug}${ref}`} className="line-clamp-2 text-sm font-semibold leading-snug text-navy">{p.name}</Link>
                      {p.inspiredBy && <p className="line-clamp-1 text-[11px] text-navy/55">Inspiré de {p.inspiredBy}</p>}
                      {p.price ? <p className="mt-1 text-sm font-semibold text-navy">{priceLabel(p.price, p.multiFormat).replace(/^à/, "À")}</p> : null}
                      <div className="mt-auto flex gap-1.5 pt-2">
                        <Link href={`/produits/${p.slug}${ref}`} className="flex-1 rounded-full bg-navy px-2 py-2 text-center text-xs font-semibold text-white">Commander</Link>
                        {ask && (
                          <a href={ask} target="_blank" rel="noopener noreferrer" aria-label={`Demander ${p.name} sur WhatsApp`} className="flex items-center justify-center rounded-full bg-[#25D366] px-2.5 text-white">
                            <MessageCircle size={15} />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Avis clients */}
        {reviews.length > 0 && (
          <section className="mt-9">
            <h2 className="font-serif-display text-xl font-semibold text-navy">{reviews.some((r) => r.mine) ? "Ce que disent mes clients" : "Ce que disent les clients JAMAAL"}</h2>
            <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {reviews.map((r) => (
                <li key={r.id} className="w-64 shrink-0 snap-start rounded-2xl border border-line bg-white p-4 shadow-sm">
                  <p className="flex gap-0.5 text-amber-500" aria-label={`${r.rating} sur 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} fill={i < r.rating ? "currentColor" : "none"} />)}</p>
                  <p className="mt-2 line-clamp-5 text-sm text-navy/85">« {r.comment} »</p>
                  <p className="mt-2 text-xs font-semibold text-navy">{r.author.split(/\s+/)[0]}<span className="font-normal text-navy/55"> · {r.product}</span></p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-9 rounded-2xl bg-navy p-5 text-center text-white">
          <ShieldCheck className="mx-auto" size={24} />
          <p className="mt-2 text-sm">Produits officiels Chogan, distribués au Sénégal par JAMAAL. Paiement Wave, Orange Money ou à la livraison.</p>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy"><MessageCircle size={16} /> Écrire à {first}</a>}
        </section>

        <p className="mt-6 text-center text-xs text-navy/45">Vos commandes passées depuis cette page sont suivies personnellement par {first}.</p>
        <Link href={`/${ref}`} className="mt-6 block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo du site */}
          <img src="/logo/jamaal-logo.jpg" alt="JAMAAL Luxury Cosmetics" className="mx-auto h-14 w-auto rounded-xl" />
        </Link>
      </div>
    </div>
  );
}
