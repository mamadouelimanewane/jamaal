import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConsultantForm } from "@/components/admin/ConsultantForm";
import { updateConsultant } from "@/lib/actions/consultants";
import { sponsorOptionsList } from "@/lib/network";

export default async function EditConsultantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [consultant, sponsorOptions, piece, application] = await Promise.all([
    prisma.consultant.findUnique({ where: { id } }),
    sponsorOptionsList(),
    prisma.$queryRaw<{ front: boolean; back: boolean }[]>`SELECT "front" IS NOT NULL AS "front", "back" IS NOT NULL AS "back" FROM "ConsultantPiece" WHERE "consultantId" = ${id}`,
    prisma.$queryRaw<{ front: boolean; back: boolean }[]>`SELECT "idFront" IS NOT NULL AS "front", "idBack" IS NOT NULL AS "back" FROM "ConsultantApplication" WHERE "consultantId" = ${id} LIMIT 1`,
  ]);
  if (!consultant) notFound();
  // Photos de la fiche, à défaut celles de la candidature acceptée.
  const pieces = { front: !!(piece[0]?.front || application[0]?.front), back: !!(piece[0]?.back || application[0]?.back) };

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Modifier {consultant.name}</h1>
      <ConsultantForm action={updateConsultant.bind(null, id)} consultant={consultant} sponsorOptions={sponsorOptions} pieces={pieces} />
    </div>
  );
}
