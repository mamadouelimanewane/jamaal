import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LivreurForm } from "@/components/admin/LivreurForm";
import { CashRemittanceForm, LivreurDocForm } from "@/components/admin/LivreurAdminForms";
import { updateLivreur } from "@/lib/actions/livreurs";
import { uploadLivreurDocuments } from "@/lib/actions/livreur-signup";
import { recordCashRemittance } from "@/lib/actions/delivery";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { idTypeLabel } from "@/lib/livreur-signup";
import { KIND_LABELS, walletBalance } from "@/lib/wallet";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function EditLivreurPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("livraison", "read");
  const { id } = await params;
  const livreur = await prisma.livreur.findUnique({ where: { id }, include: { documents: { select: { id: true, side: true, mime: true, createdAt: true }, orderBy: { side: "asc" } } } });
  if (!livreur) notFound();
  const [wallet, history] = await Promise.all([
    walletBalance({ type: "LIVREUR", id }),
    prisma.walletTransaction.findMany({ where: { ownerType: "LIVREUR", ownerId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const owed = Math.max(0, -wallet.balance);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/livreurs" className="text-sm font-semibold text-rose-dark hover:underline">← Livreurs</Link>
      <h1 className="mt-2 font-serif-display text-2xl font-semibold text-navy">Modifier {livreur.name}</h1>
      <LivreurForm action={updateLivreur.bind(null, id)} livreur={livreur} />

      <section id="piece" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Pièce d&apos;identité</h2>
        {livreur.documents.length ? (
          <>
            <p className="mt-1 text-sm text-navy/75">{idTypeLabel(livreur.idType)}{livreur.idNumber ? ` n° ${livreur.idNumber}` : ""}{livreur.docsVerifiedAt ? ` · contrôlée le ${livreur.docsVerifiedAt.toLocaleDateString("fr-FR")}` : ""}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {livreur.documents.map((d) => (
                <a key={d.id} href={`/api/admin/livreur-doc/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-center text-xs font-semibold text-navy">
                  {d.mime.startsWith("image/") && d.mime !== "image/heic" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/admin/livreur-doc/${d.id}`} alt={`Pièce d'identité, ${d.side.toLowerCase()}`} className="h-36 w-56 rounded-lg border border-line object-cover" />
                  ) : (
                    <span className="flex h-36 w-56 items-center justify-center rounded-lg border border-line bg-cream">📄 Ouvrir le fichier</span>
                  )}
                  <span className="mt-1 block">{d.side === "VERSO" ? "Verso" : "Recto"}</span>
                </a>
              ))}
            </div>
            <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-navy">Remplacer la pièce</summary><div className="mt-3"><LivreurDocForm action={uploadLivreurDocuments.bind(null, id)} idType={livreur.idType} idNumber={livreur.idNumber} /></div></details>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-red-700">Aucune pièce : obligatoire pour livrer. Ajoutez la photo de sa carte d&apos;identité, de son passeport ou de son permis.</p>
            <div className="mt-3"><LivreurDocForm action={uploadLivreurDocuments.bind(null, id)} idType={livreur.idType} idNumber={livreur.idNumber} /></div>
          </>
        )}
      </section>

      <section id="wallet" className="mt-6 scroll-mt-24 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Wallet du livreur</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-cream px-4 py-3"><p className="text-sm text-navy/75">Solde</p><p className={`text-xl font-semibold ${wallet.balance < 0 ? "text-red-700" : "text-ink"}`}>{formatPrice(wallet.balance)}</p></div>
          <div className="rounded-xl bg-cream px-4 py-3"><p className="text-sm text-navy/75">Gagné (livraisons)</p><p className="text-xl font-semibold text-ink">{formatPrice(wallet.earned)}</p></div>
          <div className="rounded-xl bg-cream px-4 py-3"><p className="text-sm text-navy/75">Espèces à reverser</p><p className={`text-xl font-semibold ${owed ? "text-red-700" : "text-ink"}`}>{formatPrice(owed)}</p></div>
        </div>
        <p className="mt-2 text-xs text-navy/65">Chaque course livrée crédite automatiquement sa part. Une commande payée à la livraison inscrit en débit les espèces encaissées : le livreur les reverse (au dépôt ou par un dépôt Wave depuis son application).</p>
        <div className="mt-4"><CashRemittanceForm action={recordCashRemittance.bind(null, id)} owed={owed} /></div>
        <ul className="mt-5 divide-y divide-line text-sm">
          {history.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-ink">{KIND_LABELS[t.kind] ?? t.kind}<span className="block text-xs text-navy/60">{t.note ?? ""} · {t.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" })}{t.status !== "VALIDE" ? ` · ${t.status.toLowerCase()}` : ""}</span></span>
              <span className={`font-semibold ${t.amount < 0 ? "text-red-700" : "text-emerald-800"}`}>{t.amount > 0 ? "+" : ""}{formatPrice(t.amount)}</span>
            </li>
          ))}
          {history.length === 0 && <li className="py-2 text-navy/65">Aucun mouvement.</li>}
        </ul>
      </section>
    </div>
  );
}
