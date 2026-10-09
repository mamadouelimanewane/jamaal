import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { salesScripts, SCRIPT_CATEGORIES } from "@/data/sales-scripts";
import { ScriptCard } from "@/components/admin/ScriptCard";
import { CatalogShareCard } from "@/components/admin/CatalogShareCard";
import { getSiteUrl } from "@/lib/site-url";
import { PersonalLinkCard } from "@/components/admin/PersonalLinkCard";

export const dynamic = "force-dynamic";

/**
 * Destination : src/app/(admin)/admin/(dashboard)/outils/page.tsx
 * Accessible aux CONSULTANT (et ADMIN pour preview).
 */
export default async function OutilsVentePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const role = session.user.role;
  if (role !== "CONSULTANT" && role !== "ADMIN") redirect("/admin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { consultant: true },
  });

  // Admin sans profil consultant : mode démo
  const consultant = user?.consultant;
  const slug = (consultant as { slug?: string | null } | null)?.slug ?? "consultant-demo";
  const name = consultant?.name ?? session.user.name ?? "Consultant JAMAAL";
  const city = consultant?.city ?? "Sénégal";
  const whatsapp = consultant?.whatsapp ?? null;
  const personalPath = `/c/${slug}`;
  const personalLink =
    process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${personalPath}`
      : personalPath;

  // Top produits pour le mini-catalogue
  const products = await prisma.product.findMany({
    orderBy: [{ reviewCount: "desc" }, { name: "asc" }],
    take: 20,
    select: {
      name: true,
      shortDescription: true,
      category: true,
      regularPrice: true,
      testerPrice: true,
      volumes: true,
    },
  });

  const catalogProducts = products.map((p) => {
    const volumes = (p.volumes as { label: string; price: number }[] | null) ?? [];
    const minPrice =
      volumes.length > 0
        ? Math.min(...volumes.map((v) => v.price))
        : p.testerPrice ?? p.regularPrice ?? 0;
    return {
      name: p.name,
      shortDescription: p.shortDescription,
      category: p.category,
      priceLabel: minPrice > 0 ? `dès ${formatPrice(minPrice)}` : "Sur demande",
    };
  });

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Outils de vente</h1>
      <p className="mt-1 text-sm text-navy/75">
        Scripts WhatsApp, lien personnel et mini-catalogue à partager avec vos clients.
      </p>

      <div className="mt-8">
        <PersonalLinkCard slug={slug} siteOrigin={await getSiteUrl()} />
      </div>

      {/* Scripts */}
      <section className="mt-12">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Scripts WhatsApp</h2>
        <p className="mt-1 text-sm text-navy/75">
          Personnalisez le prénom et le produit, puis copiez le message en un clic.
        </p>

        <div className="mt-6 space-y-10">
          {SCRIPT_CATEGORIES.map((cat) => {
            const items = salesScripts.filter((s) => s.category === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy/65">
                  {cat.label}
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((script) => (
                    <ScriptCard
                      key={script.id}
                      script={script}
                      personalLink={personalLink}
                      consultantName={name}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Catalogue */}
      <section className="mt-14">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Mini-catalogue</h2>
        <p className="mt-1 text-sm text-navy/75">
          Imprimez en PDF ou téléchargez une image à envoyer sur WhatsApp / Instagram.
        </p>
        <div className="mt-6 max-w-lg">
          <CatalogShareCard
            consultantName={name}
            city={city}
            personalLink={personalLink}
            whatsapp={whatsapp}
            products={catalogProducts}
          />
        </div>
      </section>

      {/* Tips */}
      <section className="mt-14 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold text-navy">Conseils rapides</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-navy/85">
          <li>Partagez toujours votre lien personnel pour que les commandes vous soient attribuées.</li>
          <li>Commencez par un échantillon : plus facile de convaincre.</li>
          <li>Relancez poliment 48 h après un premier message sans réponse.</li>
          <li>Demandez un avis après livraison : ça crée de la preuve sociale.</li>
          <li>Proposez le métier de consultant aux clients enthousiastes.</li>
        </ul>
      </section>
    </div>
  );
}
