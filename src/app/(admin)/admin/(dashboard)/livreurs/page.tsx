import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteLivreur } from "@/lib/actions/livreurs";
import { approveLivreur, rejectLivreur } from "@/lib/actions/livreur-signup";
import { LIVREUR_PENDING, livreurDecisionMessage, vehicleLabel, waLink } from "@/lib/livreur-signup";
import { getSiteUrl } from "@/lib/site-url";
import { CopyButton } from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

export default async function AdminLivreursPage({ searchParams }: { searchParams: Promise<{ valide?: string; refuse?: string }> }) {
  const { valide, refuse } = await searchParams;
  const [all, site] = await Promise.all([
    prisma.livreur.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { orders: true } } } }),
    getSiteUrl(),
  ]);
  const livreurs = all.filter((l) => l.status !== LIVREUR_PENDING);
  const pending = all.filter((l) => l.status === LIVREUR_PENDING).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const appUrl = `${site.replace(/\/$/, "")}/livreur`;
  const justApproved = valide ? all.find((l) => l.id === valide) : undefined;
  const invite = `Bonjour, rejoignez les livreurs JAMAAL 🛵 : installez l'application JAMAAL Livreur et inscrivez-vous ici : ${appUrl}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Livreurs ({livreurs.length})
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/livreurs/carte"
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
          >
            🗺️ Carte flotte GPS
          </Link>
          <Link
            href="/admin/livreurs/nouveau"
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            + Nouveau livreur
          </Link>
        </div>
      </div>

      {justApproved && (
        <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-700/20 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span><strong>{justApproved.name}</strong> est validé : il peut se connecter à l&apos;application.</span>
          <a href={waLink(justApproved.phone, livreurDecisionMessage(justApproved.name, true, appUrl))} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#128C4B] px-4 py-2 text-xs font-semibold text-white">Le prévenir sur WhatsApp</a>
        </div>
      )}
      {refuse && <p role="status" className="mt-5 rounded-2xl border border-line bg-cream p-4 text-sm text-navy">Inscription refusée et supprimée.</p>}

      <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-navy">📲 Lien d&apos;inscription des livreurs</h2>
        <p className="mt-1 text-sm text-navy/70">À envoyer aux futurs livreurs : ils installent l&apos;application JAMAAL Livreur (obligatoire), s&apos;inscrivent, puis vous validez leur dossier ici.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 break-all rounded-lg bg-cream px-3 py-2 text-sm text-navy">{appUrl}</code>
          <CopyButton text={appUrl} label="Copier le lien" />
          <a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#128C4B] px-4 py-2 text-xs font-semibold text-white">Partager sur WhatsApp</a>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50/60 p-4 sm:p-5">
          <h2 className="font-semibold text-navy">Inscriptions à valider ({pending.length})</h2>
          <ul className="mt-3 space-y-3">
            {pending.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{l.name}</p>
                  <p className="text-navy/75">{l.phone} · {vehicleLabel(l.vehicle) || "—"} · {l.zone || "zone non précisée"}</p>
                  <p className="text-xs text-navy/60">
                    Inscrit le {l.createdAt.toLocaleDateString("fr-FR")}
                    {l.walletProvider ? ` · gains sur ${l.walletProvider === "WAVE" ? "Wave" : "Orange Money"} ${l.walletNumber ?? ""}` : ""}
                    {l.idNumber ? ` · pièce n° ${l.idNumber}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={waLink(l.phone, `Bonjour ${l.name.split(/\s+/)[0]}, ici l'équipe JAMAAL au sujet de votre inscription de livreur.`)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-navy hover:bg-cream">WhatsApp</a>
                  <form action={approveLivreur.bind(null, l.id)}><button className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-light">Valider</button></form>
                  <form action={rejectLivreur.bind(null, l.id)}><button className="rounded-full border border-rose-dark/40 px-4 py-2 text-xs font-semibold text-rose-dark hover:bg-rose/10">Refuser</button></form>
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
              <th className="px-4 py-3">Livraisons</th>
              <th className="px-4 py-3">Dernière position</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {livreurs.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{l.name}{(l.vehicle || l.zone) && <span className="block text-xs font-normal text-navy/60">{[vehicleLabel(l.vehicle), l.zone].filter(Boolean).join(" · ")}</span>}</td>
                <td className="px-4 py-3 text-navy/85">{l.phone}</td>
                <td className="px-4 py-3 text-navy/85">{l._count.orders}</td>
                <td className="px-4 py-3 text-navy/85">
                  {l.lastLat && l.lastLng ? (
                    <a
                      href={`https://www.google.com/maps?q=${l.lastLat},${l.lastLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      Voir sur la carte
                    </a>
                  ) : (
                    <span className="text-xs text-navy/65">Non partagée</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.active ? (
                    <span className="text-xs font-semibold text-green-700">Actif</span>
                  ) : (
                    <span className="text-xs font-semibold text-navy/65">Inactif</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/livreurs/${l.id}/modifier`}
                    className="mr-3 text-xs font-semibold text-navy hover:underline"
                  >
                    Modifier
                  </Link>
                  <form action={deleteLivreur.bind(null, l.id)} className="inline">
                    <button className="text-xs font-semibold text-rose-dark hover:underline">
                      Supprimer
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
