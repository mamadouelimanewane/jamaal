import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { ApplicationActions } from "@/components/admin/ApplicationActions";

export const dynamic = "force-dynamic";

const statusLabel = { NOUVELLE: "Nouvelle", ACCEPTEE: "Acceptée", REFUSEE: "Refusée" } as const;
const statusStyle = {
  NOUVELLE: "bg-amber-100 text-amber-800",
  ACCEPTEE: "bg-emerald-100 text-emerald-800",
  REFUSEE: "bg-navy/10 text-navy/60",
} as const;

export default async function CandidaturesPage() {
  await requireAdmin();
  const applications = await prisma.consultantApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const pendingCount = applications.filter((a) => a.status === "NOUVELLE").length;

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Candidatures revendeurs ({pendingCount} en attente)
      </h1>
      <p className="mt-1 text-sm text-navy/60">
        Accepter une candidature crée le profil revendeur, son lien personnel et son compte. La
        personne choisit son mot de passe via un lien d&apos;activation.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Candidat·e</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Ville</th>
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
                  <p className="text-xs text-navy/50">{a.createdAt.toLocaleDateString("fr-FR")}</p>
                  {a.sponsorCode && <p className="text-xs text-navy/50">Parrain : {a.sponsorCode}</p>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <a className="text-rose-dark hover:underline" href={`https://wa.me/${a.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                    {a.phone}
                  </a>
                  <p className="text-navy/60">{a.email}</p>
                </td>
                <td className="px-4 py-3">{a.city}{a.country !== "Sénégal" ? `, ${a.country}` : ""}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-navy/70">
                  {a.experience && <p><span className="font-semibold">Expérience :</span> {a.experience}</p>}
                  {a.motivation && <p className="mt-1"><span className="font-semibold">Motivation :</span> {a.motivation}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3">{a.status === "NOUVELLE" ? <ApplicationActions id={a.id} /> : null}</td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-navy/50">Aucune candidature pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
