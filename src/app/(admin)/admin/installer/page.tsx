import type { Metadata } from "next";
import Image from "next/image";
import { InstallGuide } from "@/components/admin/InstallGuide";
import { safeNext } from "@/lib/install-env";

export const metadata: Metadata = { title: "Installer l'application JAMAAL" };

/**
 * Page envoyée à chaque nouveau revendeur (parrain ou filleul) avec son lien d'espace : installation de
 * l'application JAMAAL (icône sur l'écran d'accueil), puis accès à l'espace. Publique, dans la portée /admin
 * de l'application pour que l'installation ouvre bien l'espace revendeur.
 */
export default async function InstallerPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const next = safeNext(suite);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f1ee] p-4">
      <section className="w-full max-w-md rounded-3xl border border-line bg-white p-7 text-center shadow-xl shadow-navy/10">
        <Image src="/icons/icon-192.png" alt="Icône de l'application JAMAAL" width={96} height={96} className="mx-auto rounded-[22px] shadow-lg" priority />
        <h1 className="mt-5 font-serif-display text-2xl font-semibold text-navy">Installez JAMAAL sur votre téléphone</h1>
        <p className="mt-2 text-sm leading-6 text-navy/75">Votre espace revendeur s&apos;ouvre ensuite d&apos;un seul geste, avec l&apos;icône JAMAAL, comme une application : ventes, clients, filleuls, gains et marketing.</p>
        <div className="mt-6"><InstallGuide next={next} /></div>
        <p className="mt-5 text-xs text-navy/55">Gratuit, sans passer par le Play Store ni l&apos;App Store. Rien n&apos;est installé sans votre accord.</p>
      </section>
    </main>
  );
}
