import { prisma } from "@/lib/prisma";
import { getReseller } from "@/lib/reseller";
import { getProtocol } from "@/lib/protocol-store";
import { fillProtocol, pieceLabel } from "@/lib/protocol";
import { ProtocolText } from "@/components/ProtocolText";
import { SignProtocolForm } from "@/components/admin/SignProtocolForm";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon protocole" };

export default async function MyProtocolPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const [doc, signatures, c] = await Promise.all([
    getProtocol(),
    prisma.protocolSignature.findMany({ where: { consultantId: me.id }, orderBy: { signedAt: "desc" }, select: { id: true, version: true, signedAt: true } }),
    prisma.consultant.findUnique({ where: { id: me.id }, select: { name: true, whatsapp: true, address: true, idType: true, idNumber: true, sponsor: { select: { slug: true } } } }),
  ]);
  const current = signatures.find((s) => s.version === doc.version);
  const text = fillProtocol(doc.text, { nom: c?.name, piece: pieceLabel(c?.idType, c?.idNumber), adresse: c?.address ?? "", telephone: c?.whatsapp, code_parrain: c?.sponsor?.slug ?? "" });

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon protocole de partenariat</h1>
      {current ? (
        <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Vous avez signé la version en vigueur (v{doc.version}) le {current.signedAt.toLocaleDateString("fr-FR")}.{" "}
          <a href={`/api/protocole/${current.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Télécharger mon exemplaire (PDF)</a>
        </p>
      ) : (
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {signatures.length ? `Le protocole a été mis à jour (version ${doc.version}) : lisez-le et signez la nouvelle version.` : "Lisez le protocole de partenariat et signez-le en bas de page."}
        </p>
      )}
      {(!c?.idNumber || !c?.address) && !current && (
        <p className="mt-2 text-xs text-navy/70">Votre adresse et votre pièce d&apos;identité ne sont pas encore enregistrées : l&apos;équipe JAMAAL vous les demandera.</p>
      )}
      <div className="mt-5 max-h-[60vh] overflow-y-auto rounded-2xl border border-line bg-white p-5">
        <ProtocolText text={text} />
      </div>
      {!current && !me.viewAs && <div className="mt-5"><SignProtocolForm version={doc.version} /></div>}
      {signatures.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-navy">Mes exemplaires signés</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {signatures.map((s) => (
              <li key={s.id}>Version {s.version}, signée le {s.signedAt.toLocaleDateString("fr-FR")} · <a href={`/api/protocole/${s.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-dark hover:underline">PDF</a></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
