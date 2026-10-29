import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { StaffLoginForm, type LoginNotice } from "@/components/StaffLoginForm";
import { LivreurApp } from "@/components/livreur/LivreurApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "JAMAAL Livreur",
  description: "L'application des livreurs JAMAAL : inscription, tournées et livraisons.",
  manifest: "/livreur.webmanifest",
  icons: { icon: "/icons/livreur-192.png", apple: "/icons/livreur-apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "JAMAAL Livreur", statusBarStyle: "default" },
};

async function logout() {
  "use server";
  await signOut({ redirectTo: "/admin/livreur" });
}

/**
 * Adresse unique des livreurs (www.jamaal.sn/livreur y mène) : l'application JAMAAL Livreur doit d'abord
 * être installée sur le téléphone ; une fois ouverte depuis son icône, inscription ou connexion.
 */
export default async function LivreurAppPage({ searchParams }: { searchParams: Promise<LoginNotice & { mode?: string }> }) {
  const notice = await searchParams;
  const session = await auth();
  const role = session?.user?.role;

  if (session && role !== "LIVREUR") {
    return (
      <Shell>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Application Livreur</h1>
        <p className="mt-3 text-sm leading-6 text-navy/75">Le compte {session.user?.phone ?? session.user?.email} n&apos;est pas un compte livreur. Déconnectez-vous pour vous inscrire ou vous connecter comme livreur.</p>
        <form action={logout} className="mt-6"><button className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white">Se déconnecter</button></form>
        <Link href="/admin" className="mt-4 block text-sm font-semibold text-rose-dark">Retour à mon espace</Link>
      </Shell>
    );
  }

  const tab = notice.mode === "connexion" || notice.erreur || notice.lien || notice.reset ? "login" : "signup";
  return (
    <Shell>
      <LivreurApp loggedIn={role === "LIVREUR"} initialTab={tab} login={<StaffLoginForm from="/admin/livreur" next="/admin/mes-livraisons" notice={notice} />} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-[#f8f1ee] p-4 sm:items-center">
      <section className="w-full max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-xl shadow-navy/10 sm:p-7">
        <Image src="/icons/livreur-192.png" alt="Icône JAMAAL Livreur" width={72} height={72} className="mx-auto rounded-[18px] shadow-md" priority />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-rose-dark">JAMAAL Livreur</p>
        <div className="mt-3">{children}</div>
      </section>
    </main>
  );
}
