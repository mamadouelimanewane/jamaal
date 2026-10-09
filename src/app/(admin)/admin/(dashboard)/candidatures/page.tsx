import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { ApplicationActions } from "@/components/admin/ApplicationActions";
import { pieceLabel } from "@/lib/protocol";

export const dynamic = "force-dynamic";

const statusLabel = { NOUVELLE: "Nouvelle", ACCEPTEE: "Acceptée", REFUSEE: "Refusée" } as const;
const statusStyle = {
  NOUVELLE: "bg-amber-100 text-amber-800",
  ACCEPTEE: "bg-emerald-100 text-emerald-800",
  REFUSEE: "bg-navy/10 text-navy/75",
} as const;

export default async function CandidaturesPage() {
  await requireAdmin();
  const applications = await prisma.consultantApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    // Les photos ne sont pas chargées ici : seulement leur présence (servies par une route réservée aux admins).
    omit: { idFront: true, idBack: true },
    include: { signature: { select: { id: true, version: true, signedAt: true } } },
  });
  const photos = new Map(
    (await prisma.$queryRaw<{ id: string; front: boolean; back: boolean }[]>`SELECT "id", "idFront" IS NOT NULL AS "front", "idBack" IS NOT NULL AS "back" FROM "ConsultantApplication" WHERE "id" = ANY(${applications.map((a) => a.id)})`).map((r) => [r.id, r])
  );
  const pendingCount = applications.filter((a) => a.status === "NOUVELLE").length;

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Candidatures consultants ({pendingCount} en attente)
      </h1>
      <p className="mt-1 text-sm text-navy/75">
        Accepter une candidature crée le profil consultant, son lien personnel et son compte. La
        personne choisit son mot de passe via un lien d&apos;activation. La validation demande la pièce
        d&apos;identité (recto et verso) et le protocole signé.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Candidat·e</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Identité et protocole</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id} className="border-t border-line align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy">{a.name}</p>
                  <p className="text-xs text-navy/70">{a.createdAt.toLocaleDateString("fr-FR")}</p>
                  {a.sponsorCode && <p className="text-xs text-navy/70">Parrain : {a.sponsorCode}</p>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <a className="text-rose-dark hover:underline" href={`https://wa.me/${a.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                    {a.phone}
                  </a>
                  <p className="text-navy/75">{a.email}</p>
                </td>
                <td className="px-4 py-3">{a.city}{a.country !== "Sénégal" ? `, ${a.country}` : ""}</td>
                <td className="min-w-[220px] px-4 py-3 text-xs text-navy/85">
                  {a.address && <p><span className="font-semibold">Adresse :</span> {a.address}</p>}
                  {a.idNumber ? <p className="mt-1"><span className="font-semibold">{pieceLabel(a.idType, a.idNumber)}</span></p> : <p className="mt-1 font-semibold text-amber-800">Pas de pièce d&apos;identité</p>}
                  {(photos.get(a.id)?.front || photos.get(a.id)?.back) && (
                    <div className="mt-1.5 flex gap-2">
                      {(["recto", "verso"] as const).map((face) => (face === "recto" ? photos.get(a.id)?.front : photos.get(a.id)?.back) ? (
                        <a key={face} href={`/api/admin/candidatures/${a.id}/piece?face=${face}`} target="_blank" rel="noopener noreferrer" title={`Ouvrir le ${face}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/admin/candidatures/${a.id}/piece?face=${face}`} alt={`Pièce d'identité, ${face}`} className="h-14 w-20 rounded-md border border-line object-cover" />
                        </a>
                      ) : null)}
                    </div>
                  )}
                  {a.signature ? (
                    <p className="mt-1.5">
                      Protocole v{a.signature.version} signé le {a.signature.signedAt.toLocaleDateString("fr-FR")} ·{" "}
                      <a href={`/api/protocole/${a.signature.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-dark hover:underline">PDF</a>
                    </p>
                  ) : (
                    <p className="mt-1.5 font-semibold text-amber-800">Protocole non signé</p>
                  )}
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-navy/85">
                  {a.experience && <p><span className="font-semibold">Expérience :</span> {a.experience}</p>}
                  {a.motivation && <p className="mt-1"><span className="font-semibold">Motivation :</span> {a.motivation}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3"><ApplicationActions id={a.id} status={a.status} complete={!!(a.idNumber && a.signature && photos.get(a.id)?.front && photos.get(a.id)?.back)} /></td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-navy/70">Aucune candidature pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
