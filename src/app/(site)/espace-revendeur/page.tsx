import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { StaffLoginForm, type LoginNotice } from "@/components/StaffLoginForm";

export const metadata: Metadata = {
  title: "Espace consultant",
  robots: { index: false },
};

export default async function EspaceRevendeurPage({ searchParams }: { searchParams: Promise<LoginNotice> }) {
  const notice = await searchParams;
  const session = await auth();
  if (session) redirect("/admin");

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <BrandLogo height={104} priority className="mx-auto mb-6" />
      <p className="luxury-eyebrow">Espace consultant</p>
      <h1 className="mt-2 font-serif-display text-3xl font-semibold text-navy">Connexion</h1>
      <p className="mt-3 text-sm text-navy/70">
        Retrouvez vos commandes, votre lien de vente personnel, vos commissions, votre équipe et vos outils de vente.
      </p>
      <div className="mt-2 rounded-2xl border border-line bg-white p-6">
        <StaffLoginForm from="/espace-revendeur" notice={notice} />
      </div>
      <p className="mt-6 text-center text-sm text-navy/60">
        Pas encore consultant·e ?{" "}
        <Link href="/devenir-consultant" className="font-semibold text-rose-dark hover:underline">Postuler</Link>
      </p>
    </div>
  );
}
