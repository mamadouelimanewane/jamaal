import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LivreurForm } from "@/components/admin/LivreurForm";
import { updateLivreur } from "@/lib/actions/livreurs";

export default async function EditLivreurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const livreur = await prisma.livreur.findUnique({ where: { id } });
  if (!livreur) notFound();

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Modifier {livreur.name}</h1>
      <LivreurForm action={updateLivreur.bind(null, id)} livreur={livreur} />
    </div>
  );
}
