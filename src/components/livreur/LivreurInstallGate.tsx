"use client";

import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useInstall } from "@/components/admin/InstallApp";

/**
 * Espace livreur : l'application JAMAAL Livreur est obligatoire. Ouvert dans un navigateur (pas depuis
 * l'icône), l'espace est masqué et renvoie vers l'installation.
 */
export function LivreurInstallGate() {
  const { installed } = useInstall();
  if (installed) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lv-gate-title" className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#f8f1ee] p-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-6 text-center shadow-xl shadow-navy/10">
        <Image src="/icons/v2/jamaal-192.png" alt="Icône JAMAAL" width={72} height={72} className="mx-auto rounded-[18px] shadow-md" />
        <p className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"><Lock size={13} /> Application obligatoire</p>
        <h2 id="lv-gate-title" className="mt-3 font-serif-display text-2xl font-semibold text-navy">Ouvrez l&apos;application JAMAAL Livreur</h2>
        <p className="mt-2 text-sm leading-6 text-navy/75">Vos livraisons s&apos;utilisent uniquement depuis l&apos;application installée sur votre téléphone. Déjà installée ? Ouvrez-la avec l&apos;icône <strong>JAMAAL Livreur</strong>.</p>
        <Link href="/admin/livreur" className="mt-5 block rounded-full bg-rose-dark px-6 py-3.5 text-sm font-semibold text-white">Installer l&apos;application</Link>
      </div>
    </div>
  );
}
