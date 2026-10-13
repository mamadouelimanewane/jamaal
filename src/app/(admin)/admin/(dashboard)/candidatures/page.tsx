import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { ApplicationActions } from "@/components/admin/ApplicationActions";
import { pieceLabel } from "@/lib/protocol";
import { setApplicationSponsor } from "@/lib/actions/applications";
import { createSponsorCode, deleteSponsorCode, toggleSponsorCode } from "@/lib/actions/sponsor-codes";
import { resolveSponsorCode } from "@/lib/sponsor-codes";

const field = "rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

export const dynamic = "force-dynamic";

const statusLabel = { NOUVELLE: "Nouvelle", ACCEPTEE: "Acceptée", REFUSEE: "Refusée" } as const;
const statusStyle = {
  NOUVELLE: "bg-amber-100 text-amber-800",
  ACCEPTEE: "bg-emerald-100 text-emerald-800",
  REFUSEE: "bg-navy/10 text-navy/75",
} as const;

export default async function CandidaturesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await requireAdmin();
  const { ok, erreur } = await searchParams;
  const [codes, sponsors] = await Promise.all([
    prisma.sponsorCode.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []),
    prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, city: true } }),
  ]);
  const sponsorName = new Map(sponsors.map((c) => [c.id, c.name]));
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
  // Parrain réel de chaque candidature en attente (code personnel ou code créé par l'admin).
  const resolved = new Map(await Promise.all(applications.filter((a) => a.status === "NOUVELLE" && a.sponsorCode).map(async (a) => [a.id, await resolveSponsorCode(a.sponsorCode!)] as const)));

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

      {ok && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{ok}</p>}
      {erreur && <p role="alert" className="mt-4 rounded-xl bg-rose/10 px-4 py-2 text-sm text-rose-dark">{erreur}</p>}

      <section id="codes" className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Codes de parrainage</h2>
        <p className="mt-1 text-sm text-navy/75">
          Le code est obligatoire pour postuler. Chaque revendeur a déjà le sien (son identifiant). Créez ici des codes à donner aux personnes qui n&apos;ont pas de parrain (ex. <strong>jamaal</strong>, <strong>salon2026</strong>) : la candidature est rattachée au parrain choisi.
        </p>
        <form action={createSponsorCode} className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_1fr_auto]">
          <input name="code" required minLength={2} maxLength={48} pattern="[A-Za-z0-9\-]{2,48}" placeholder="Code (ex. jamaal)" className={field} aria-label="Code" />
          <select name="consultantId" required defaultValue="" className={field} aria-label="Parrain">
            <option value="" disabled>Parrain des candidats…</option>
            {sponsors.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
          </select>
          <input name="label" maxLength={120} placeholder="Note (facultatif) : salon, page Facebook…" className={field} aria-label="Note" />
          <button className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">Créer le code</button>
        </form>
        {codes.length > 0 && (
          <ul className="mt-4 divide-y divide-line text-sm">
            {codes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong className={c.active ? "text-navy" : "text-navy/40 line-through"}>{c.code}</strong>
                  <span className="text-navy/70"> → {sponsorName.get(c.consultantId) ?? "parrain inactif"}</span>
                  {c.label && <span className="text-navy/55"> · {c.label}</span>}
                </span>
                <span className="flex gap-3 text-xs font-semibold">
                  <form action={toggleSponsorCode.bind(null, c.id)}><button className="text-navy/75 hover:underline">{c.active ? "Désactiver" : "Réactiver"}</button></form>
                  <form action={deleteSponsorCode.bind(null, c.id)}><button className="text-rose-dark hover:underline">Supprimer</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                  {a.sponsorCode && <p className="text-xs text-navy/70">Code : {a.sponsorCode}{a.status === "NOUVELLE" ? (resolved.get(a.id) ? ` → ${resolved.get(a.id)!.name}` : " (inconnu ou inactif)") : ""}</p>}
                  {a.status === "NOUVELLE" && (
                    <form action={setApplicationSponsor.bind(null, a.id)} className="mt-1.5 flex gap-1">
                      <select name="sponsorCode" defaultValue="" required className="max-w-[10rem] rounded-lg border border-line px-1.5 py-1 text-xs" aria-label="Changer de parrain">
                        <option value="" disabled>Changer de parrain…</option>
                        {codes.filter((c) => c.active).map((c) => <option key={c.id} value={c.code}>Code {c.code}</option>)}
                        {sponsors.filter((c) => c.slug).map((c) => <option key={c.id} value={c.slug!}>{c.name}</option>)}
                      </select>
                      <button className="rounded-lg border border-line px-2 text-xs font-semibold text-navy hover:bg-cream">OK</button>
                    </form>
                  )}
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
