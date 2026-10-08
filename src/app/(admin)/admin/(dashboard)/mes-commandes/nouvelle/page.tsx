import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConsultantOrderForm } from "@/components/admin/ConsultantOrderForm";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";

export default async function NewConsultantOrderPage() {
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") redirect("/admin");
  const [user, model] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user!.id }, select: { consultant: { select: { deliveryAddress: true, deliveryLat: true, deliveryLng: true } } } }),
    getBusinessModel(),
  ]);
  const me = user?.consultant;

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Nouvelle commande pour mon client
      </h1>
      <p className="mt-1 text-sm text-navy/75">
        Choisissez les produits, renseignez votre client, puis où livrer : chez lui, ou chez vous si vous achetez pour son compte.
      </p>
      <ConsultantOrderForm depot={{ lat: model.depotLat, lng: model.depotLng, label: model.depotLabel }} vendor={{ address: me?.deliveryAddress ?? null, lat: me?.deliveryLat ?? null, lng: me?.deliveryLng ?? null }} />
    </div>
  );
}
