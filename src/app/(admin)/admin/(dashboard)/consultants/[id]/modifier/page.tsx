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
  const [consultant, sponsorOptions] = await Promise.all([
    prisma.consultant.findUnique({ where: { id } }),
    prisma.consultant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
  ]);
  if (!consultant) notFound();

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Modifier {consultant.name}</h1>
      <ConsultantForm action={updateConsultant.bind(null, id)} consultant={consultant} sponsorOptions={sponsorOptions} />
    </div>
  );
}
