import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { deleteOffer, saveOffer } from "@/lib/actions/growth";
import { ProductPicker } from "@/components/admin/GrowthWidgets";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offres de fêtes" };

const OCCASIONS = ["Tabaski", "Korité", "Magal", "Gamou", "Saint-Valentin", "Fête des mères", "Fête des pères", "Noël", "Fin d'année", "Rentrée", "Mariage", "Black Friday"];
const day = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireAdminPage("marketing");
  const { edit } = await searchParams;
  const [offers, products] = await Promise.all([
    prisma.offer.findMany({ orderBy: [{ active: "desc" }, { endsAt: "desc" }] }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, choganCode: true, regularPrice: true, volumes: true } }),
  ]);
  const minPrice = (p: (typeof products)[number]) => {
    const v = ((p.volumes as { price: number }[] | null) ?? []).map((x) => x.price).filter((x) => x > 0);
    return v.length ? Math.min(...v) : p.regularPrice;
  };
  const picker = products.map((p) => ({ id: p.id, name: p.name, code: p.choganCode, price: minPrice(p) }));
  const priceOf = new Map(picker.map((p) => [p.id, p.price ?? 0]));
  const current = edit ? offers.find((o) => o.id === edit) : null;
  const now = new Date();
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-ia">Croissance</p>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Offres de fêtes et coffrets</h1>
        <p className="mt-1 text-sm text-navy/75">Un coffret = plusieurs produits à un prix spécial, sur une période. La remise s&apos;applique toute seule au panier (site et WhatsApp) quand tous les produits y sont. Les offres en cours s&apos;affichent sur l&apos;accueil et sur la page Offres, et le coach des revendeurs les connaît.</p>
      </div>

      <form action={saveOffer} className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        <h2 className="font-semibold text-navy sm:col-span-2">{current ? `Modifier « ${current.title} »` : "Nouvelle offre"}</h2>
        {current && <input type="hidden" name="id" value={current.id} />}
        <label className="text-xs font-semibold text-navy/85 sm:col-span-2">
          Titre
          <input name="title" required minLength={3} maxLength={120} defaultValue={current?.title ?? ""} placeholder="Coffret Tabaski Homme" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Occasion
          <input name="occasion" list="occasions" defaultValue={current?.occasion ?? ""} placeholder="Tabaski" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
          <datalist id="occasions">{OCCASIONS.map((o) => <option key={o} value={o} />)}</datalist>
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Prix du coffret (FCFA)
          <input name="packPrice" type="number" required min={500} defaultValue={current?.packPrice ?? ""} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Début
          <input name="startsAt" type="date" required defaultValue={day(current?.startsAt) || day(now)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85">
          Fin (incluse)
          <input name="endsAt" type="date" required defaultValue={day(current?.endsAt)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <div className="text-xs font-semibold text-navy/85 sm:col-span-2">
          Produits du coffret
          <div className="mt-1 font-normal">
            <ProductPicker products={picker} initial={current?.productIds ?? []} />
          </div>
        </div>
        <label className="text-xs font-semibold text-navy/85 sm:col-span-2">
          Description
          <textarea name="description" rows={3} maxLength={1500} defaultValue={current?.description ?? ""} placeholder="Le duo parfait pour la fête : un extrait de parfum et son gel douche assorti." className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-navy/85 sm:col-span-2">
          Image (adresse, facultatif : sinon les photos des produits)
          <input name="image" defaultValue={current?.image ?? ""} placeholder="https://…" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-navy/85 sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={current ? current.active : true} /> Offre active
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button className="rounded-full bg-ia px-5 py-2.5 text-sm font-semibold text-white hover:bg-ia-dark">{current ? "Enregistrer" : "Créer l'offre"}</button>
          {current && <Link href="/admin/offres" className="rounded-full border border-line px-5 py-2.5 text-sm">Annuler</Link>}
        </div>
      </form>

      <div className="space-y-3">
        {offers.map((o) => {
          const value = o.productIds.reduce((s, id) => s + (priceOf.get(id) ?? 0), 0);
          const live = o.active && o.startsAt <= now && o.endsAt >= now;
          return (
            <article key={o.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy">
                    {o.title} {o.occasion && <span className="text-xs font-normal text-navy/60">· {o.occasion}</span>}
                  </p>
                  <p className="text-xs text-navy/70">
                    {o.productIds.length} produits · {formatPrice(o.packPrice)} au lieu de {formatPrice(value)} ({value > o.packPrice ? `−${formatPrice(value - o.packPrice)}` : "aucune remise : prix trop haut"}) · du {o.startsAt.toLocaleDateString("fr-FR")} au {o.endsAt.toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className={`rounded-full px-2.5 py-1 ${live ? "bg-ia-light text-ia-dark" : "bg-navy/5 text-navy/70"}`}>{live ? "En cours" : o.active ? (o.startsAt > now ? "À venir" : "Terminée") : "Inactive"}</span>
                  <Link href={`/offres/${o.slug}`} className="text-navy hover:underline">Voir</Link>
                  <Link href={`/admin/offres?edit=${o.id}`} className="text-navy hover:underline">Modifier</Link>
                  <form action={deleteOffer.bind(null, o.id)}>
                    <button className="text-rose-dark hover:underline">Supprimer</button>
                  </form>
                </div>
              </div>
            </article>
          );
        })}
        {!offers.length && <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-navy/70">Aucune offre pour le moment.</p>}
      </div>
    </div>
  );
}
