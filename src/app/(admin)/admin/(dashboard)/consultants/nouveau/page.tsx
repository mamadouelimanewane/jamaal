import { ConsultantForm } from "@/components/admin/ConsultantForm";
import { createConsultant } from "@/lib/actions/consultants";

export default function NewConsultantPage() {
  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Nouveau consultant</h1>
      <ConsultantForm action={createConsultant} />
    </div>
  );
}
