import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteLivreur } from "@/lib/actions/livreurs";
import { approveLivreur, rejectLivreur, setLivreurSuspended } from "@/lib/actions/livreur-signup";
import { LIVREUR_PENDING, LIVREUR_REFUSED, idTypeLabel, livreurDecisionMessage, vehicleLabel, waLink } from "@/lib/livreur-signup";
import { getSiteUrl } from "@/lib/site-url";
import { formatPrice } from "@/lib/currency";
import { ago, isFresh } from "@/lib/geo-track";
import { CopyButton } from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

const REASONS = ["Pièce d'identité illisible", "Pièce d'identité expirée", "Nom différent de la pièce", "Zone non desservie", "Effectif complet pour le moment", "Dossier incomplet"];

export default async function AdminLivreursPage({ searchParams }: { searchParams: Promise<{ valide?: string; refuse?: string; erreur?: string }> }) {
  const { valide, refuse, erreur } = await searchParams;
  const [all, site, balances] = await Promise.all([
    prisma.livreur.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true } }, documents: { select: { id: true, side: true, mime: true, kind: true }, orderBy: { side: "asc" } } },
    }),
    getSiteUrl(),
    prisma.walletTransaction.groupBy({ by: ["ownerId"], where: { ownerType: "LIVREUR", status: "VALIDE" }, _sum: { amount: true } }),
  ]);
  const balance = new Map(balances.map((b) => [b.ownerId, b._sum.amount ?? 0]));
  const livreurs = all.filter((l) => l.status !== LIVREUR_PENDING && l.status !== LIVREUR_REFUSED);
  const pending = all.filter((l) => l.status === LIVREUR_PENDING).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const refused = all.filter((l) => l.status === LIVREUR_REFUSED);
  const appUrl = `${site.replace(/\/$/, "")}/livreur`;
  const justApproved = valide ? all.find((l) => l.id === valide) : undefined;
  const justRefused = refuse ? all.find((l) => l.id === refuse) : undefined;
  const invite = `Bonjour, rejoignez les livreurs JAMAAL 🛵 : installez l'application JAMAAL Livreur et inscrivez-vous ici : ${appUrl}`;
  const refusalText = (name: string, reason: string | null) => `${livreurDecisionMessage(name, false, appUrl)}${reason ? ` Motif : ${reason}.` : ""} Vous pouvez vous réinscrire depuis l'application : ${appUrl}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Livreurs ({livreurs.length})</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/livraisons" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Livraisons</Link>
          <Link href="/admin/livreurs/carte" className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">🗺️ Carte flotte GPS</Link>
          <Link href="/admin/modele-economique#livraison" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Tarifs et commissions</Link>
          <Link href="/admin/livreurs/nouveau" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">+ Nouveau livreur</Link>
        </div>
      </div>

      {erreur === "piece" && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Pièce d&apos;identité manquante : ajoutez-la (Modifier › Pièce d&apos;identité) avant de valider ou de réactiver ce livreur.</p>}
      {justApproved && (
        <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-700/20 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span><strong>{justApproved.name}</strong> est validé : il peut se connecter à l&apos;application.</span>
          <a href={waLink(justApproved.phone, livreurDecisionMessage(justApproved.name, true, appUrl))} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#128C4B] px-4 py-2 text-xs font-semibold text-white">Le prévenir sur WhatsApp</a>
        </div>
      )}
      {justRefused && (
        <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-cream p-4 text-sm text-navy">
          <span>Inscription de <strong>{justRefused.name}</strong> refusée ({justRefused.rejectReason}). Les photos de sa pièce ont été effacées.</span>
          <a href={waLink(justRefused.phone, refusalText(justRefused.name, justRefused.rejectReason))} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#128C4B] px-4 py-2 text-xs font-semibold text-white">Le prévenir sur WhatsApp</a>
        </div>
      )}

      <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-navy">📲 Lien d&apos;inscription des livreurs</h2>
        <p className="mt-1 text-sm text-navy/70">À envoyer aux futurs livreurs : ils installent l&apos;application JAMAAL Livreur (obligatoire), s&apos;inscrivent avec leur pièce d&apos;identité, puis vous validez ou refusez leur dossier ici.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 break-all rounded-lg bg-cream px-3 py-2 text-sm text-navy">{appUrl}</code>
          <CopyButton text={appUrl} label="Copier le lien" />
          <a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#128C4B] px-4 py-2 text-xs font-semibold text-white">Partager sur WhatsApp</a>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50/60 p-4 sm:p-5">
          <h2 className="font-semibold text-navy">Inscriptions à valider ({pending.length})</h2>
          <p className="mt-1 text-xs text-navy/70">Vérifiez que le nom et la photo de la pièce correspondent, et que la pièce n&apos;est pas expirée.</p>
          <ul className="mt-3 space-y-3">
            {pending.map((l) => (
              <li key={l.id} className="rounded-xl border border-line bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{l.name}</p>
                    <p className="text-navy/75">{l.phone} · {vehicleLabel(l.vehicle) || "—"} · {l.zone || "zone non précisée"}</p>
                    <p className="text-xs text-navy/60">
                      Inscrit le {l.createdAt.toLocaleDateString("fr-FR")}
                      {l.walletProvider ? ` · gains sur ${l.walletProvider === "WAVE" ? "Wave" : "Orange Money"} ${l.walletNumber ?? ""}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-navy">{idTypeLabel(l.idType)}{l.idNumber ? ` n° ${l.idNumber}` : ""}</p>
                  </div>
                  <a href={waLink(l.phone, `Bonjour ${l.name.split(/\s+/)[0]}, ici l'équipe JAMAAL au sujet de votre inscription de livreur.`)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-navy hover:bg-cream">WhatsApp</a>
                </div>
                <DocThumbs docs={l.documents} />
                {!l.documents.length && <p className="mt-2 text-xs font-semibold text-red-700">Aucune pièce d&apos;identité : validation impossible.</p>}
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
                  <form action={approveLivreur.bind(null, l.id)}>
                    <button disabled={!l.documents.length} className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-40">Valider le livreur</button>
                  </form>
                  <form action={rejectLivreur.bind(null, l.id)} className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-navy/75">
                      Motif du refus
                      <select name="reason" className="mt-1 block rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-navy">
                        {REASONS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </label>
                    <button className="rounded-full border border-rose-dark/40 px-4 py-2 text-xs font-semibold text-rose-dark hover:bg-rose/10">Refuser</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Téléphone / WhatsApp</th>
              <th className="px-4 py-3">Pièce d&apos;identité</th>
              <th className="px-4 py-3">Livraisons</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {livreurs.map((l) => {
              const b = balance.get(l.id) ?? 0;
              return (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-navy">{l.name}{(l.vehicle || l.zone) && <span className="block text-xs font-normal text-navy/60">{[vehicleLabel(l.vehicle), l.zone].filter(Boolean).join(" · ")}</span>}</td>
                  <td className="px-4 py-3 text-navy/85">{l.phone}</td>
                  <td className="px-4 py-3">
                    {l.documents.length ? (
                      <span className="text-xs font-semibold text-emerald-800">✓ {idTypeLabel(l.idType)}<DocThumbs docs={l.documents} small /></span>
                    ) : (
                      <Link href={`/admin/livreurs/${l.id}/modifier#piece`} className="text-xs font-semibold text-red-700 hover:underline">Manquante · ajouter</Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy/85">{l._count.orders}</td>
                  <td className={`px-4 py-3 font-semibold ${b < 0 ? "text-red-700" : "text-ink"}`}>
                    <Link href={`/admin/livreurs/${l.id}/modifier#wallet`} className="hover:underline">{formatPrice(b)}</Link>
                    {b < 0 && <span className="block text-xs font-normal">espèces à reverser</span>}
                  </td>
                  <td className="px-4 py-3 text-navy/85">
                    {l.lastLat && l.lastLng ? (
                      <span className={`text-xs font-semibold ${isFresh(l.lastSeenAt) ? "text-emerald-700" : "text-navy/65"}`}>{isFresh(l.lastSeenAt) ? "En direct" : ago(l.lastSeenAt)}</span>
                    ) : (
                      <span className="text-xs text-navy/65">Jamais localisé</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{l.active ? <span className="text-xs font-semibold text-green-700">Actif</span> : <span className="text-xs font-semibold text-red-700">Désactivé</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/admin/livreurs/${l.id}/modifier`} className="mr-3 text-xs font-semibold text-navy hover:underline">Modifier</Link>
                    <form action={setLivreurSuspended.bind(null, l.id, l.active)} className="mr-3 inline">
                      <button title={l.active ? "Le livreur ne peut plus se connecter ni recevoir de course" : "Le livreur peut de nouveau se connecter"} className={`rounded-full px-3 py-1 text-xs font-semibold ${l.active ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}>{l.active ? "Désactiver" : "Réactiver"}</button>
                    </form>
                    {l._count.orders === 0 && (
                      <form action={deleteLivreur.bind(null, l.id)} className="inline">
                        <button className="text-xs font-semibold text-rose-dark hover:underline">Supprimer</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {refused.length > 0 && (
        <details className="mt-6 rounded-2xl border border-line bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-navy">Inscriptions refusées ({refused.length})</summary>
          <ul className="mt-3 divide-y divide-line">
            {refused.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-navy">{l.name} · {l.phone}<span className="block text-xs text-navy/60">{l.rejectReason}</span></span>
                <a href={waLink(l.phone, refusalText(l.name, l.rejectReason))} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-cream">Prévenir sur WhatsApp</a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function DocThumbs({ docs, small = false }: { docs: { id: string; side: string; mime: string }[]; small?: boolean }) {
  if (!docs.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${small ? "mt-1" : "mt-3"}`}>
      {docs.map((d) => (
        <a key={d.id} href={`/api/admin/livreur-doc/${d.id}`} target="_blank" rel="noopener noreferrer" className="group block text-center text-[11px] font-semibold text-navy" title={`Ouvrir le ${d.side.toLowerCase()}`}>
          {d.mime.startsWith("image/") && d.mime !== "image/heic" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/admin/livreur-doc/${d.id}`} alt={`Pièce d'identité, ${d.side.toLowerCase()}`} className={`${small ? "h-10 w-16" : "h-28 w-44"} rounded-lg border border-line object-cover group-hover:opacity-90`} />
          ) : (
            <span className={`${small ? "h-10 w-16" : "h-28 w-44"} flex items-center justify-center rounded-lg border border-line bg-cream`}>📄 {d.mime === "application/pdf" ? "PDF" : "HEIC"}</span>
          )}
          {!small && <span className="mt-0.5 block">{d.side === "VERSO" ? "Verso" : "Recto"}</span>}
        </a>
      ))}
    </div>
  );
}
