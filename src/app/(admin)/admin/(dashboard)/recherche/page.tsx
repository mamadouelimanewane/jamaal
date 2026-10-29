import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/access";
import { rateLimit } from "@/lib/rate-limit";
import { backofficeSearch, type BoItem } from "@/lib/backoffice-search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recherche" };

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

function List({ title, items }: { title: string; items: BoItem[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-navy">{title} <span className="text-navy/50">· {items.length}</span></h2>
      <ul className="mt-2 divide-y divide-line">
        {items.map((it) => (
          <li key={it.id}>
            <Link href={it.href} className="flex items-center justify-between gap-3 py-2.5 hover:bg-cream/50">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-navy">{it.title}</span>
                <span className="block truncate text-xs text-navy/65">{it.subtitle}</span>
              </span>
              {it.badge && <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-navy/75">{it.badge}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Page de résultats de la recherche du back-office : tous les produits (avec stock), commandes, clients, etc. */
export default async function BackofficeSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; marque?: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/admin/login");
  const { q = "", cat, marque } = await searchParams;
  const [access, user] = await Promise.all([getAccess(userId), prisma.user.findUnique({ where: { id: userId }, select: { consultantId: true, livreurId: true } })]);
  if (!access) redirect("/admin");
  // Phrases en langage naturel : expansion IA, 10 par minute et par membre.
  const allowAi = async () => (await rateLimit(`bo-search-ai:${userId}`, { limit: 10, windowMs: 60_000 })).ok;
  const r = await backofficeSearch({ role: access.role, perms: access.perms, consultantId: user?.consultantId ?? null, livreurId: user?.livreurId ?? null }, q, { full: true, allowAi });
  let products = r.products;
  if (cat) products = products.filter((p) => p.categorySlug === cat);
  if (marque) products = products.filter((p) => p.inspiredBrand === marque);
  const base = `/admin/recherche?q=${encodeURIComponent(r.query || q)}`;

  return (
    <div className="max-w-6xl space-y-6">
      <form action="/admin/recherche" className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3">
        <Search size={18} className="shrink-0 text-rose-dark" />
        <input name="q" defaultValue={q} placeholder="Un parfum, un code, une commande, un client…" aria-label="Rechercher" className="min-w-0 flex-1 bg-transparent text-base text-navy outline-none" />
        <button className="rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white">Rechercher</button>
      </form>

      {q.trim().length < 2 ? (
        <p className="text-sm text-navy/70">Tapez au moins deux caractères.</p>
      ) : (
        <>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">Résultats pour « {r.corrected ?? q} »</h1>
            {r.corrected && <p className="mt-1 text-sm text-navy/70">Au lieu de « {q} ».</p>}
          </div>

          {(r.brands.length > 0 || r.categories.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {(cat || marque) && <Link href={base} className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">Tout ({r.products.length})</Link>}
              {r.categories.map((c) => (
                <Link key={c.slug} href={`${base}&cat=${c.slug}`} className={`rounded-full border px-3 py-1 text-xs ${cat === c.slug ? "border-navy bg-navy text-white" : "border-line text-navy hover:bg-cream"}`}>{c.label} · {c.count}</Link>
              ))}
              {r.brands.map((b) => (
                <Link key={b.brand} href={`${base}&marque=${encodeURIComponent(b.brand)}`} className={`rounded-full border px-3 py-1 text-xs ${marque === b.brand ? "border-navy bg-navy text-white" : "border-line text-navy hover:bg-cream"}`}>{b.brand} · {b.count}</Link>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <List title="Commandes" items={r.orders} />
            <List title="Clients" items={r.customers} />
            <List title="Conseillers" items={r.consultants} />
            <List title="Livreurs" items={r.livreurs} />
            <List title="Codes promo" items={r.coupons} />
          </div>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-navy">Produits <span className="text-navy/50">· {products.length}</span></h2>
            {products.length === 0 ? (
              <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-navy/65">Aucun produit. Essayez un grand parfum, une marque, un code Chogan ou une note olfactive.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {products.map((p) => (
                  <Link key={p.id} href={p.href} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:shadow-md">
                    <span className="relative flex aspect-square items-center justify-center bg-cream" style={p.photo ? undefined : { background: `linear-gradient(140deg, ${p.colorFrom}, ${p.colorTo})` }}>
                      {p.photo ? <Image src={p.photo} alt="" fill sizes="200px" className="object-contain p-3" /> : <Package size={28} className="text-white/90" />}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 p-3">
                      <span className="line-clamp-2 text-sm font-semibold text-navy">{p.name}</span>
                      {p.inspiredBy && <span className="line-clamp-1 text-xs text-navy/70">Inspiré de {p.inspiredBy}</span>}
                      <span className="text-[11px] uppercase tracking-wide text-navy/50">{p.code ? `${p.code} · ` : ""}{p.category}</span>
                      <span className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <span className="text-sm font-semibold text-navy">{p.price ? fcfa(p.price) : ""}</span>
                        {p.stock !== null && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.stock > 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{p.stock > 0 ? `${p.stock} en stock` : "rupture"}</span>}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
