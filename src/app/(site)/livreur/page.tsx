import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/livreur" });
}

export default async function LivreurEntryPage() {
  const session = await auth();

  if (!session) {
    redirect("/admin/login?next=/livreur");
  }

  if (session.user?.role === "LIVREUR") {
    redirect("/admin/mes-livraisons");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Espace Livreur</h1>
      <p className="mt-3 text-sm text-navy/70">
        Le compte {session.user?.email} n&apos;est pas un compte livreur. Déconnectez-vous pour vous
        connecter avec un compte livreur.
      </p>
      <form action={logoutAction} className="mt-6">
        <button className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white">
          Se déconnecter
        </button>
      </form>
      <Link href="/" className="mt-4 block text-sm font-semibold text-rose-dark">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
