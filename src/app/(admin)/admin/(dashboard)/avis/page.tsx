import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { approveReview, deleteReview } from "@/lib/actions/reviews";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avis clients" };

export default async function ReviewsAdminPage() {
  await requireAdminPage("clients");
  const [pending, approved] = await Promise.all([
    prisma.review.findMany({ where: { approved: false }, orderBy: { createdAt: "desc" }, take: 100, include: { product: { select: { name: true, slug: true } } } }),
    prisma.review.findMany({ where: { approved: true }, orderBy: { createdAt: "desc" }, take: 30, include: { product: { select: { name: true, slug: true } } } }),
  ]);
  const Card = ({ r, pendingView }: { r: (typeof pending)[number]; pendingView: boolean }) => (
    <article className="flex gap-4 rounded-2xl border border-line bg-white p-4">
      {r.photo && (
        <a href={r.photo} target="_blank" rel="noopener noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- photo client (Blob), taille libre */}
          <img src={r.photo} alt={`Photo de ${r.authorName}`} className="h-24 w-24 rounded-xl object-cover" />
        </a>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">
          {"★".repeat(r.rating)}<span className="text-navy/25">{"★".repeat(5 - r.rating)}</span> · {r.authorName}
          {r.orderId && <span className="ml-2 rounded-full bg-ia-light px-2 py-0.5 text-[11px] font-semibold text-ia-dark">Achat vérifié</span>}
        </p>
        <p className="text-xs text-navy/60">
          <Link href={`/produits/${r.product.slug}`} className="underline">{r.product.name}</Link> · {r.createdAt.toLocaleDateString("fr-FR")}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-navy/85">{r.comment}</p>
        <div className="mt-2 flex gap-3 text-xs font-semibold">
          {pendingView && (
            <form action={approveReview.bind(null, r.id)}>
              <button className="rounded-full bg-ia px-3 py-1.5 text-white hover:bg-ia-dark">Publier</button>
            </form>
          )}
          <form action={deleteReview.bind(null, r.id)}>
            <button className="rounded-full border border-line px-3 py-1.5 text-rose-dark">Supprimer</button>
          </form>
        </div>
      </div>
    </article>
  );
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-ia">Confiance</p>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Avis clients</h1>
        <p className="mt-1 text-sm text-navy/75">Les avis (avec photo) arrivent après la livraison, grâce au lien envoyé sur WhatsApp, ou depuis les fiches produits. Rien n&apos;est publié sans votre accord.</p>
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold text-navy">À valider ({pending.length})</h2>
        {pending.map((r) => <Card key={r.id} r={r} pendingView />)}
        {!pending.length && <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-navy/70">Aucun avis en attente.</p>}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold text-navy">Publiés récemment</h2>
        {approved.map((r) => <Card key={r.id} r={r} pendingView={false} />)}
      </section>
    </div>
  );
}
