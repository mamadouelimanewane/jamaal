import { prisma } from "@/lib/prisma";
import { ConsultantForm } from "@/components/admin/ConsultantForm";
import { createConsultant } from "@/lib/actions/consultants";

export default async function NewConsultantPage() {
  const sponsorOptions = await prisma.consultant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true },
  });

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Nouveau consultant</h1>
      <ConsultantForm action={createConsultant} sponsorOptions={sponsorOptions} />
    </div>
  );
}
