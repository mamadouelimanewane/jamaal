import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProtocol } from "@/lib/protocol-store";
import { ProtocolEditor } from "@/components/admin/ProtocolEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Protocole de partenariat" };

export default async function ProtocolPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");
  const [doc, members, signed] = await Promise.all([
    getProtocol(),
    prisma.consultant.count({ where: { active: true } }),
    prisma.protocolSignature.findMany({ where: { consultantId: { not: null } }, select: { consultantId: true, version: true }, distinct: ["consultantId", "version"] }),
  ]);
  const onCurrent = new Set(signed.filter((s) => s.version === doc.version).map((s) => s.consultantId)).size;

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Protocole de partenariat</h1>
      <p className="mt-1 text-sm text-navy/75">
        Version {doc.version}{doc.updatedAt ? `, modifiée le ${new Date(doc.updatedAt).toLocaleDateString("fr-FR")}` : " (texte proposé par défaut)"} ·{" "}
        <strong>{onCurrent} membre(s) actif(s) sur {members}</strong> l&apos;ont signée.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-navy/80">
        <li>Chaque candidat le lit et le signe à l&apos;écran ; chaque membre déjà en place peut le signer depuis « Mon profil ».</li>
        <li>Modifier le texte crée une nouvelle version : les signatures précédentes restent valables pour leur version, les membres sont invités à signer la nouvelle.</li>
        <li>Mise en forme : « ## » au début d&apos;une ligne pour un titre d&apos;article, « - » pour une puce, « 1. » pour une liste numérotée, une ligne vide entre deux paragraphes.</li>
        <li>Champs remplis automatiquement : {"{nom}"}, {"{piece}"}, {"{adresse}"}, {"{telephone}"}, {"{code_parrain}"}. Les passages entre crochets [ ] sont à compléter avant la mise en service.</li>
      </ul>
      <div className="mt-5"><ProtocolEditor text={doc.text} /></div>
    </div>
  );
}
