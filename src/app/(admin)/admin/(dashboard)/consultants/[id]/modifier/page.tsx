import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConsultantForm } from "@/components/admin/ConsultantForm";
import { updateConsultant } from "@/lib/actions/consultants";

export default async function EditConsultantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const consultant = await prisma.consultant.findUnique({ where: { id } });
  if (!consultant) notFound();

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Modifier {consultant.name}</h1>
      <ConsultantForm action={updateConsultant.bind(null, id)} consultant={consultant} />
    </div>
  );
}
