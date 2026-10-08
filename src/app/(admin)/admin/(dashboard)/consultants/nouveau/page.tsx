import { ConsultantForm } from "@/components/admin/ConsultantForm";
import { createConsultant } from "@/lib/actions/consultants";
import { sponsorOptionsList } from "@/lib/network";

export default async function NewConsultantPage() {
  const sponsorOptions = await sponsorOptionsList();

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Nouveau consultant</h1>
      <ConsultantForm action={createConsultant} sponsorOptions={sponsorOptions} />
    </div>
  );
}
