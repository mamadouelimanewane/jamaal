import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Camera, ShieldCheck, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { getSkinVisuals } from "@/lib/skin/visuals";
import { SkinAdvisor } from "@/components/skin/SkinAdvisor";
import { SkinIllustration } from "@/components/skin/SkinIllustration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = {
  title: "Skin Advisor JAMAAL : votre routine de soins en un selfie",
  description: "Analyse de peau gratuite pensée pour les peaux noires et métissées : un selfie, quelques questions, et votre routine de soins Chogan personnalisée.",
};

export default async function SkinAdvisorPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const slug = (ref || (await cookies()).get("jamaal_ref")?.value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || null;
  const [reseller, origin, visuals] = await Promise.all([
    slug ? prisma.consultant.findFirst({ where: { slug, active: true }, select: { name: true, whatsapp: true, slug: true } }).catch(() => null) : Promise.resolve(null),
    getSiteUrl().catch(() => ""),
    getSkinVisuals(),
  ]);
  const digits = (reseller?.whatsapp ?? "").replace(/\D/g, "").replace(/^00/, "");
  const advisor = reseller && digits.length >= 9 ? { name: reseller.name.split(/\s+/)[0], whatsapp: digits.length === 9 ? `221${digits}` : digits } : { name: "JAMAAL", whatsapp: WHATSAPP_CONTACTS[0].number };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="luxury-eyebrow">Nouveau · Skin Advisor</p>
          <h1 className="mt-2 font-serif-display text-4xl font-semibold leading-tight text-navy sm:text-5xl">Une peau éclatante, à portée de selfie</h1>
          <p className="mt-4 text-base leading-relaxed text-navy/75">
            Prenez un selfie, répondez à quelques questions : nous analysons votre peau et vous proposons votre routine de soins, matin et soir.
            Pensé d&apos;abord pour les <strong>peaux noires et métissées</strong> : taches, marques, teint terne, brillance, sans jamais chercher à éclaircir votre peau.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-navy/80">
            <li className="flex gap-2"><Camera size={18} className="shrink-0 text-rose-dark" /> 2 minutes, gratuit, sans inscription</li>
            <li className="flex gap-2"><Sparkles size={18} className="shrink-0 text-rose-dark" /> Routine avec les soins Chogan adaptés à votre peau</li>
            <li className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-rose-dark" /> Photo analysée puis effacée : jamais enregistrée</li>
          </ul>
          {reseller && <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-sm text-navy">Votre conseillère : <strong>{reseller.name}</strong></p>}
        </div>
        <div className={`grid gap-3 ${visuals.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {visuals.length ? (
            visuals.slice(0, 4).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- visuels du stockage du site
              <img key={src} src={src} alt="Femme africaine à la peau éclatante" className={`w-full rounded-3xl object-cover shadow-lg ${visuals.length > 2 && i === 0 ? "col-span-2 aspect-[4/3]" : "aspect-[4/5]"}`} />
            ))
          ) : (
            <SkinIllustration className="w-full rounded-3xl shadow-lg" />
          )}
        </div>
      </section>

      <div className="mt-12">
        <SkinAdvisor origin={origin} refSlug={reseller?.slug ?? null} advisor={advisor} />
      </div>
    </div>
  );
}
