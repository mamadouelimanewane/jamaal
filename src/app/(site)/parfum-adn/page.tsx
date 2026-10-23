import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Dna, Gift, Timer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { REFERENCE } from "@/lib/scent/adn";
import { ScentAdn } from "@/components/scent/ScentAdn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Parfum ADN : trouvez votre parfum en 1 minute",
  description: "Dites-nous les parfums que vous portez (Sauvage, J'adore, Baccarat Rouge…) : nous trouvons les parfums JAMAAL qui vous ressemblent, avec leur pourcentage de correspondance.",
};

const title = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export default async function ParfumAdnPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const slug = (ref || (await cookies()).get("jamaal_ref")?.value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || null;
  const [reseller, inspired] = await Promise.all([
    slug ? prisma.consultant.findFirst({ where: { slug, active: true }, select: { name: true, whatsapp: true, slug: true } }).catch(() => null) : Promise.resolve(null),
    prisma.product.findMany({ where: { category: { startsWith: "parfum" }, inspiredBy: { not: null } }, select: { inspiredBy: true }, distinct: ["inspiredBy"], take: 600 }).catch(() => []),
  ]);
  const digits = (reseller?.whatsapp ?? "").replace(/\D/g, "").replace(/^00/, "");
  const advisor = reseller && digits.length >= 9 ? { name: reseller.name.split(/\s+/)[0], whatsapp: digits.length === 9 ? `221${digits}` : digits } : { name: "JAMAAL", whatsapp: WHATSAPP_CONTACTS[0].number };
  const suggestions = [...new Set([...inspired.map((p) => p.inspiredBy!.trim()), ...REFERENCE.map((r) => title(r.names[0]))].filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="max-w-3xl">
        <p className="luxury-eyebrow">Nouveau · Parfum ADN</p>
        <h1 className="mt-2 font-serif-display text-4xl font-semibold leading-tight text-navy sm:text-5xl">Votre parfum, retrouvé en une minute</h1>
        <p className="mt-4 text-base leading-relaxed text-navy/75">
          Dites-nous les parfums que vous portez déjà : nous lisons leurs familles et leurs notes, puis nous vous proposons les parfums JAMAAL qui vous ressemblent, avec leur pourcentage de correspondance.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy/80">
          <li className="flex gap-2"><Timer size={18} className="text-rose-dark" /> 1 minute, gratuit</li>
          <li className="flex gap-2"><Dna size={18} className="text-rose-dark" /> Plus de 30 grands parfums reconnus</li>
          <li className="flex gap-2"><Gift size={18} className="text-rose-dark" /> Idéal aussi pour offrir</li>
        </ul>
        {reseller && <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-sm text-navy">Votre conseiller·e : <strong>{reseller.name}</strong></p>}
      </section>
      <div className="mt-10">
        <ScentAdn suggestions={suggestions} refSlug={reseller?.slug ?? null} advisor={advisor} />
      </div>
    </div>
  );
}
