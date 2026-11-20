import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getReseller } from "@/lib/reseller";
import { getSiteUrl } from "@/lib/site-url";
import { GroupDealsManager } from "@/components/admin/GroupDealsManager";

export default async function GroupDealsPage() {
  const me = await getReseller();
  if (!me || me.viewAs) redirect("/admin");
  const [products, deals, origin] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, volumes: true }, orderBy: { name: "asc" } }),
    prisma.groupDeal.findMany({ where: { consultantId: me.id }, include: { _count: { select: { participants: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    getSiteUrl(),
  ]);
  const options = products.map((p) => ({ id: p.id, name: p.name, volumes: ((p.volumes as { label?: string; price?: number }[] | null) ?? []).filter((v): v is { label: string; price?: number } => !!v.label) }));
  return <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-8"><header><h1 className="text-2xl font-bold">Achats groupés</h1><p className="mt-1 text-slate-600">Réunissez vos clients autour d’un produit et récompensez leur mobilisation.</p></header><GroupDealsManager products={options} deals={deals} origin={origin} slug={me.slug} /></main>;
}
