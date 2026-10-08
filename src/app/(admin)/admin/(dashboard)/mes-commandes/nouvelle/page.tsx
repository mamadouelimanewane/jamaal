import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConsultantOrderForm } from "@/components/admin/ConsultantOrderForm";

export default async function NewConsultantOrderPage() {
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") redirect("/admin");

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Nouvelle commande pour mon client
      </h1>
      <p className="mt-1 text-sm text-navy/75">
        Choisissez les produits, renseignez votre client et décidez qui livre.
      </p>
      <ConsultantOrderForm />
    </div>
  );
}
